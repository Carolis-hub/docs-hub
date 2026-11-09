import { createHash } from 'node:crypto'
import path from 'node:path'
import {
  FieldValue,
  type DocumentReference,
  type Firestore,
} from 'firebase-admin/firestore'
import type { Article, Block, Classificacao } from '../../src/types/content.ts'
import type { EstadoArquivoIngestao } from '../../src/types/ingestao.ts'
import { classificarDocumento } from '../../src/utils/classificar.ts'
import { slugify } from '../../src/utils/slug.ts'
import type { ResultadoImagem } from '../migrate/images.ts'
import { planejar } from '../migrate/plan.ts'
import type {
  Manifesto,
  ManifestoArtigo,
  ManifestoBloco,
  Relatorio,
} from '../migrate/types.ts'
import {
  hashDoConteudo,
  lerTexto,
  nomeDaPasta,
  prepararDocumento,
  varrer,
  type ArquivoFonte,
  type DocumentoLido,
} from './fonte.ts'
import { resumirMudancas } from './mudancas.ts'

export type EstadoArquivo = EstadoArquivoIngestao

export type Destino =
  'criado' | 'atualizado-na-fila' | 'revisao-pendente' | 'sem-mudanca-real'

export interface ResultadoArquivo {
  caminho: string
  estado: EstadoArquivo
  artigoId?: string
  destino?: Destino
  /** Motivo do erro, do ignorado ou o arquivo de que este é cópia. */
  detalhe?: string
  classificacao?: Classificacao
}

export interface ResultadoIngestao {
  fonteId: string
  arquivos: ResultadoArquivo[]
  contagem: Record<EstadoArquivo, number>
  /** Relatório do importador (imagens com falha, links quebrados, avisos). */
  conversao: Relatorio
}

export interface OpcoesIngestao {
  pasta: string
  /** Produto de destino: id, nome ou slug do bloco raiz. */
  produto: string
  /** Bloco (subproduto) dentro do produto que recebe os arquivos; padrão: o próprio produto. */
  bloco?: string
  /** Nome da fonte; padrão: produto + nome da pasta. Identifica os registros no Firestore. */
  fonte?: string
  gravar: boolean
  autorId: string
  agora: number
  /** Como a rodada foi disparada; aparece no painel de sincronização. */
  modo?: 'manual' | 'observar' | 'git'
  /** Repositório e commit de onde a pasta veio (quando ela é um checkout do Git). */
  repo?: string
  commit?: string
  resolverImagem(src: string, dirDoArtigo: string): Promise<ResultadoImagem>
  verificarLink?(href: string): Promise<string | null>
}

interface Registro {
  fonteId: string
  caminho: string
  hash: string
  status: 'ativo' | 'duplicado' | 'erro' | 'removido'
  artigoId?: string
  duplicadoDe?: string
  erro?: string
}

const curto = (texto: string, n: number) =>
  createHash('sha1').update(texto).digest('hex').slice(0, n)

const idDoRegistro = (fonteId: string, caminho: string) =>
  `${fonteId}__${curto(caminho, 16)}`

const idNoManifesto = (fonteId: string, caminho: string) =>
  `${fonteId}/${caminho}#${curto(caminho, 6)}`

const idPlanejado = (idManifesto: string) => `m-${slugify(idManifesto)}`

async function lerTodos(refs: DocumentReference[]) {
  const mapa = new Map<string, FirebaseFirestore.DocumentData | undefined>()
  for (let i = 0; i < refs.length; i += 300) {
    const lote = refs.slice(i, i + 300)
    const snaps = lote.length ? await lote[0]!.firestore.getAll(...lote) : []
    snaps.forEach((s) => mapa.set(s.ref.path, s.exists ? s.data() : undefined))
  }
  return mapa
}

async function acharProduto(db: Firestore, ref: string) {
  const raiz = await db.collection('blocks').where('parentId', '==', null).get()
  const alvo = raiz.docs.find(
    (d) =>
      d.id === ref ||
      slugify(String(d.get('nome') ?? '')) === slugify(ref) ||
      d.get('slug') === slugify(ref),
  )
  if (!alvo)
    throw new Error(`Produto "${ref}" não encontrado (id, nome ou slug).`)
  return { id: alvo.id, nome: String(alvo.get('nome') ?? '') }
}

/**
 * Subproduto (bloco) de destino: id, nome ou slug, dentro do produto. Quando
 * não acha, a mensagem lista os blocos do produto com seus ids.
 */
async function acharBloco(
  db: Firestore,
  produto: { id: string; nome: string },
  ref: string,
) {
  const todos = await db
    .collection('blocks')
    .where('productId', '==', produto.id)
    .get()
  const filhos = todos.docs.filter((d) => d.get('parentId') !== null)
  const porId = filhos.find((d) => d.id === ref)
  if (porId) return porId
  const nomeOuSlug = filhos.filter(
    (d) =>
      slugify(String(d.get('nome') ?? '')) === slugify(ref) ||
      d.get('slug') === slugify(ref),
  )
  if (nomeOuSlug.length === 1) return nomeOuSlug[0]!
  const lista = (nomeOuSlug.length > 1 ? nomeOuSlug : filhos)
    .map((d) => `  - ${String(d.get('nome') ?? '')} (id: ${d.id})`)
    .join('\n')
  throw new Error(
    nomeOuSlug.length > 1
      ? `Mais de um bloco chamado "${ref}" no produto "${produto.nome}". Use o id:\n${lista}`
      : `Bloco "${ref}" não existe dentro do produto "${produto.nome}".` +
          (lista ? `\nBlocos do produto:\n${lista}` : ''),
  )
}

/**
 * Sincroniza uma pasta de documentos com o docs-hub. Nunca publica: arquivo
 * novo entra na fila de revisão; arquivo alterado atualiza o item que ainda
 * está na fila, ou vira uma sugestão pendente quando o artigo já foi
 * publicado ou editado por uma pessoa (a versão publicada continua no ar);
 * arquivo removido só marca o artigo para análise de despublicação.
 */
export async function ingerir(
  db: Firestore,
  opts: OpcoesIngestao,
): Promise<ResultadoIngestao> {
  const inicioMs = Date.now()
  const produto = await acharProduto(db, opts.produto)
  let destinoId = produto.id
  let produtoDoDestino = produto.id
  if (opts.bloco) {
    const snap = await acharBloco(db, produto, opts.bloco)
    destinoId = snap.id
    produtoDoDestino = produto.id
  }
  const fonteId = slugify(
    opts.fonte ?? `${produto.nome}-${path.basename(path.resolve(opts.pasta))}`,
  )

  // 1. Lê a pasta: hash, título, conteúdo preparado e classificação.
  const varredura = await varrer(opts.pasta)
  const resultados: ResultadoArquivo[] = varredura.ignorados.map((i) => ({
    caminho: i.caminho,
    estado: 'ignorado',
    detalhe: i.motivo,
  }))
  const lidos = new Map<
    string,
    {
      arquivo: ArquivoFonte
      hash: string
      doc: DocumentoLido
      classificacao: Classificacao
    }
  >()
  for (const arquivo of varredura.arquivos) {
    try {
      const texto = await lerTexto(opts.pasta, arquivo.caminho)
      const doc = prepararDocumento(texto, arquivo.formato, arquivo.caminho)
      lidos.set(arquivo.caminho, {
        arquivo,
        hash: hashDoConteudo(texto),
        doc,
        classificacao: classificarDocumento({
          titulo: doc.titulo,
          caminho: arquivo.caminho,
          texto: doc.texto,
        }),
      })
    } catch (e) {
      resultados.push({
        caminho: arquivo.caminho,
        estado: 'erro',
        detalhe: (e as Error).message,
      })
    }
  }

  // 2. Registros anteriores desta fonte.
  const regSnap = await db
    .collection('fontes')
    .where('fonteId', '==', fonteId)
    .get()
  const registros = new Map<string, Registro>(
    regSnap.docs.map((d) => [d.get('caminho') as string, d.data() as Registro]),
  )

  // 3. Duplicados: o mesmo conteúdo em vários arquivos vira um artigo só.
  const porHash = new Map<string, string[]>()
  for (const [caminho, l] of lidos) {
    porHash.set(l.hash, [...(porHash.get(l.hash) ?? []), caminho])
  }
  const copiaDe = new Map<string, string>()
  for (const caminhos of porHash.values()) {
    if (caminhos.length < 2) continue
    const ativos = caminhos.filter((c) => {
      const r = registros.get(c)
      return r?.status === 'ativo' && r.artigoId
    })
    const original = ativos[0] ?? caminhos[0]!
    for (const c of caminhos) {
      if (c !== original && !ativos.includes(c)) copiaDe.set(c, original)
    }
  }

  // 4. Estado de cada arquivo lido.
  const estados = new Map<string, EstadoArquivo>()
  for (const [caminho, l] of lidos) {
    const r = registros.get(caminho)
    let estado: EstadoArquivo
    if (copiaDe.has(caminho)) estado = 'duplicado'
    else if (!r) estado = 'novo'
    else if (r.status === 'ativo')
      estado = r.hash === l.hash ? 'sem-alteracao' : 'alterado'
    else if (r.status === 'removido')
      estado =
        r.hash === l.hash && r.artigoId
          ? 'reapareceu'
          : r.artigoId
            ? 'alterado'
            : 'novo'
    else if (r.status === 'duplicado') estado = 'novo'
    else estado = r.artigoId ? 'alterado' : 'novo' // erro: tenta de novo
    estados.set(caminho, estado)
  }

  // 5. Converte tudo o que existe (os links entre documentos precisam do conjunto inteiro).
  const manifestoBlocos: ManifestoBloco[] = [{ id: 'raiz', nome: produto.nome }]
  const dirs = new Set<string>()
  const artigosManifesto: ManifestoArtigo[] = []
  const idManifestoPorCaminho = new Map<string, string>()
  const conteudoPorId = new Map<string, string>()
  for (const [caminho, l] of lidos) {
    if (estados.get(caminho) === 'duplicado') continue
    const dir = path.posix.dirname(caminho)
    for (
      let acc = '', partes = dir === '.' ? [] : dir.split('/');
      partes.length;
    ) {
      const nome = partes.shift()!
      const pai = acc || 'raiz'
      acc = acc ? `${acc}/${nome}` : nome
      if (!dirs.has(acc)) {
        dirs.add(acc)
        manifestoBlocos.push({
          id: acc,
          nome: nomeDaPasta(nome),
          pai: pai === 'raiz' ? 'raiz' : pai,
        })
      }
    }
    const id = idNoManifesto(fonteId, caminho)
    idManifestoPorCaminho.set(caminho, id)
    conteudoPorId.set(id, l.doc.conteudo)
    artigosManifesto.push({
      id,
      bloco: dir === '.' ? 'raiz' : dir,
      titulo: l.doc.titulo,
      arquivo: caminho,
      formato: l.doc.formato,
      atualizadoEm: new Date(l.arquivo.modificadoEm).toISOString(),
    })
  }
  const manifesto: Manifesto = {
    blocos: manifestoBlocos,
    artigos: artigosManifesto,
  }
  const plano = await planejar(manifesto, {
    agora: opts.agora,
    autorId: opts.autorId,
    verificarLink: opts.verificarLink,
    lerConteudo: async (a) => conteudoPorId.get(a.id) ?? '',
    resolverImagem: opts.resolverImagem,
  })
  const planejadoPorId = new Map(plano.artigos.map((a) => [a.id, a]))
  const erroPorManifesto = new Map(
    plano.relatorio.erros.map((e) => [e.artigo, e.mensagem]),
  )

  // Ids planejados → ids reais (o bloco raiz do manifesto é o destino escolhido).
  const raizPlanejada = plano.blocos.find((b) => b.parentId === null)!.id
  const blocoReal = (id: string) => (id === raizPlanejada ? destinoId : id)
  const blocosNovos: Block[] = plano.blocos
    .filter((b) => b.id !== raizPlanejada)
    .map((b) => ({
      ...b,
      parentId: blocoReal(b.parentId as string),
      productId: produtoDoDestino,
    }))

  // 6. O que já existe no Firestore para os artigos planejados.
  const artigosRefs = [...planejadoPorId.keys()].map((id) =>
    db.collection('articles').doc(id),
  )
  const existentes = await lerTodos(artigosRefs)
  const blocosExistentes = await lerTodos(
    blocosNovos.map((b) => db.collection('blocks').doc(b.id)),
  )

  // 7. Decide e (se for gravar) escreve.
  const escritor = db.bulkWriter()
  const falhas: string[] = []
  escritor.onWriteError((erro) => {
    if ([4, 8, 10, 14].includes(erro.code) && erro.failedAttempts < 8)
      return true
    falhas.push(`${erro.documentRef.path}: ${erro.message.split('\n')[0]}`)
    return false
  })
  const set = (ref: DocumentReference, dados: Record<string, unknown>) => {
    if (opts.gravar) escritor.set(ref, dados).catch(() => undefined)
  }
  const comMerge = (ref: DocumentReference, dados: Record<string, unknown>) => {
    if (opts.gravar)
      escritor.set(ref, dados, { merge: true }).catch(() => undefined)
  }
  const atualizar = (
    ref: DocumentReference,
    dados: Record<string, unknown>,
  ) => {
    if (opts.gravar) escritor.update(ref, dados).catch(() => undefined)
  }
  const criar = (ref: DocumentReference, dados: Record<string, unknown>) => {
    if (opts.gravar) escritor.create(ref, dados).catch(() => undefined)
  }

  for (const b of blocosNovos) {
    if (blocosExistentes.get(`blocks/${b.id}`)) continue
    const { id, ...dados } = b
    set(db.collection('blocks').doc(id), dados)
  }

  const registrar = (
    caminho: string,
    l: { hash: string } | undefined,
    r: Omit<Registro, 'fonteId' | 'caminho' | 'hash'> & { hash?: string },
  ) => {
    const anterior = registros.get(caminho)
    set(db.collection('fontes').doc(idDoRegistro(fonteId, caminho)), {
      fonteId,
      caminho,
      hash: r.hash ?? l?.hash ?? anterior?.hash ?? '',
      status: r.status,
      ...(r.artigoId ? { artigoId: r.artigoId } : {}),
      ...(r.duplicadoDe ? { duplicadoDe: r.duplicadoDe } : {}),
      ...(r.erro ? { erro: r.erro } : {}),
      primeiraVez:
        (anterior as { primeiraVez?: number } | undefined)?.primeiraVez ??
        opts.agora,
      ultimaVez: opts.agora,
    })
  }

  for (const [caminho, l] of lidos) {
    const estado = estados.get(caminho)!
    const resumo: ResultadoArquivo = {
      caminho,
      estado,
      classificacao: l.classificacao,
    }
    const reg = registros.get(caminho)

    if (estado === 'duplicado') {
      const original = copiaDe.get(caminho)!
      resumo.detalhe = `mesmo conteúdo de ${original}`
      registrar(caminho, l, { status: 'duplicado', duplicadoDe: original })
      resultados.push(resumo)
      continue
    }
    if (estado === 'sem-alteracao') {
      resumo.artigoId = reg?.artigoId
      resultados.push(resumo)
      continue
    }

    const idManifesto = idManifestoPorCaminho.get(caminho)!
    const planejado = planejadoPorId.get(idPlanejado(idManifesto))
    const motivoErro = erroPorManifesto.get(idManifesto)
    if (!planejado) {
      resumo.estado = 'erro'
      resumo.detalhe = motivoErro ?? 'não foi possível converter o arquivo'
      registrar(caminho, l, {
        status: 'erro',
        erro: resumo.detalhe,
        artigoId: reg?.artigoId,
      })
      resultados.push(resumo)
      continue
    }
    resumo.artigoId = planejado.id
    const refArtigo = db.collection('articles').doc(planejado.id)
    const atual = existentes.get(refArtigo.path) as Article | undefined
    const origem = {
      tipo: 'importacao' as const,
      fonte: fonteId,
      arquivo: caminho,
      hash: l.hash,
      classificacao: l.classificacao,
      ...(opts.repo ? { repo: opts.repo } : {}),
      ...(opts.commit ? { commit: opts.commit } : {}),
    }

    if (estado === 'reapareceu' && atual) {
      atualizar(refArtigo, { flags: FieldValue.arrayRemove('origem_removida') })
      registrar(caminho, l, { status: 'ativo', artigoId: planejado.id })
      resultados.push(resumo)
      continue
    }

    if (!atual) {
      const dados: Partial<Article> = { ...planejado }
      delete dados.id
      criar(refArtigo, {
        ...dados,
        blockId: blocoReal(planejado.blockId),
        productId: produtoDoDestino,
        status: 'review',
        versao: 0,
        origem,
        categoria: l.classificacao.categoria,
        publico: l.classificacao.publico,
      })
      resumo.destino = 'criado'
    } else {
      const novoCampos = {
        titulo: planejado.titulo,
        slug: planejado.slug,
        resumo: planejado.resumo,
        conteudo: planejado.conteudo,
        textoPlano: planejado.textoPlano,
      }
      const editadoPorPessoa = atual.atualizadoPor !== opts.autorId
      if (
        !editadoPorPessoa &&
        (atual.status === 'review' || atual.status === 'draft')
      ) {
        atualizar(refArtigo, {
          ...novoCampos,
          origem,
          categoria: l.classificacao.categoria,
          publico: l.classificacao.publico,
          atualizadoEm: planejado.atualizadoEm,
          flags: FieldValue.arrayRemove('origem_removida'),
        })
        resumo.destino = 'atualizado-na-fila'
      } else if (
        atual.titulo === planejado.titulo &&
        atual.textoPlano === planejado.textoPlano
      ) {
        resumo.destino = 'sem-mudanca-real'
        atualizar(refArtigo, {
          'origem.hash': l.hash,
          flags: FieldValue.arrayRemove('origem_removida'),
        })
      } else {
        const sid = `ing-${l.hash.slice(0, 12)}`
        const refSug = refArtigo.collection('suggestions').doc(sid)
        // Uma sugestão antiga do mesmo arquivo perde a validade.
        const antigas = opts.gravar
          ? await refArtigo
              .collection('suggestions')
              .where('status', '==', 'pending')
              .get()
          : { docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }
        for (const s of antigas.docs) {
          const o = s.get('origem') as
            { tipo?: string; arquivo?: string } | undefined
          if (s.id !== sid && o?.tipo === 'ingestao' && o.arquivo === caminho) {
            atualizar(s.ref, {
              status: 'discarded',
              decididoPor: opts.autorId,
              decididoEm: opts.agora,
            })
          }
        }
        criar(refSug, {
          ...novoCampos,
          diffResumo: resumirMudancas(
            { titulo: atual.titulo, conteudo: atual.conteudo },
            { titulo: planejado.titulo, conteudo: planejado.conteudo },
          ),
          motivo: `O arquivo ${caminho} mudou na origem.`,
          avisos: [],
          pratsDesatualizados: false,
          automatico: false,
          status: 'pending',
          origem: {
            tipo: 'ingestao',
            arquivo: caminho,
            hash: l.hash,
            ...(opts.repo ? { repo: opts.repo } : {}),
            ...(opts.commit ? { commit: opts.commit } : {}),
          },
          baseVersao: atual.versao,
          baseAtualizadoEm: atual.atualizadoEm,
          modelo: 'ingestão de arquivos (sem IA)',
          criadoEm: opts.agora,
        })
        atualizar(refArtigo, {
          flags: FieldValue.arrayRemove('origem_removida'),
        })
        resumo.destino = 'revisao-pendente'
      }
    }
    registrar(caminho, l, { status: 'ativo', artigoId: planejado.id })
    resultados.push(resumo)
  }

  // 8. Arquivos que sumiram da pasta: só avisa (flag) e registra.
  for (const [caminho, r] of registros) {
    if (lidos.has(caminho) || r.status === 'removido') continue
    if (varredura.ignorados.some((i) => i.caminho === caminho)) continue
    // Um arquivo que nunca virou artigo (erro, repetido) e sumiu não pede análise:
    // só deixa de constar como pendente.
    if (r.artigoId) {
      resultados.push({ caminho, estado: 'removido', artigoId: r.artigoId })
      const ref = db.collection('articles').doc(r.artigoId)
      if ((await ref.get()).exists) {
        atualizar(ref, { flags: FieldValue.arrayUnion('origem_removida') })
      }
    }
    set(db.collection('fontes').doc(idDoRegistro(fonteId, caminho)), {
      ...r,
      status: 'removido',
      ultimaVez: opts.agora,
    })
  }

  const contagem = Object.fromEntries(
    (
      [
        'novo',
        'alterado',
        'sem-alteracao',
        'reapareceu',
        'duplicado',
        'removido',
        'erro',
        'ignorado',
      ] as const
    ).map((e) => [e, resultados.filter((r) => r.estado === e).length]),
  ) as Record<EstadoArquivo, number>

  if (opts.gravar) {
    // Resumo da rodada para o painel de sincronização (uma leitura por fonte).
    const mudou =
      contagem.novo +
        contagem.alterado +
        contagem.removido +
        contagem.reapareceu >
      0
    // `merge`: numa rodada sem mudança, `ultimaMudanca` da rodada anterior fica.
    comMerge(db.collection('sincronizacoes').doc(fonteId), {
      fonteId,
      produtoId: produto.id,
      produtoNome: produto.nome,
      ultimaExecucao: opts.agora,
      // Sem mudança, o campo não é escrito e o valor da última rodada com mudança fica.
      ...(mudou ? { ultimaMudanca: opts.agora } : {}),
      modo: opts.modo ?? 'manual',
      repo: opts.repo ?? null,
      commit: opts.commit ?? null,
      duracaoMs: Date.now() - inicioMs,
      resumo: contagem,
      erros: resultados
        .filter((r) => r.estado === 'erro')
        .slice(0, 20)
        .map((r) => ({ caminho: r.caminho, detalhe: r.detalhe ?? '' })),
      removidos: resultados
        .filter((r) => r.estado === 'removido')
        .slice(0, 20)
        .map((r) => r.caminho),
    })
    set(db.collection('auditLog').doc(), {
      usuarioId: opts.autorId,
      acao: 'ingestao.sincronizar',
      alvo: `fontes/${fonteId} (${contagem.novo} novos, ${contagem.alterado} alterados, ${contagem.removido} removidos)`,
      data: opts.agora,
    })
  }
  await escritor.close()
  if (falhas.length > 0) {
    throw new Error(
      `${falhas.length} escrita(s) falharam. Nada se perdeu: rode o mesmo comando de novo (ele só refaz o que faltou).\n  Primeira falha: ${falhas[0]}`,
    )
  }

  resultados.sort((a, b) => a.caminho.localeCompare(b.caminho))
  return { fonteId, arquivos: resultados, contagem, conversao: plano.relatorio }
}
