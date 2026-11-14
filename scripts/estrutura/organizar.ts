import type { Firestore } from 'firebase-admin/firestore'
import {
  mesmosIds,
  produtosDasUnidades,
} from '../../src/utils/acessoPorUnidade.ts'
import { slugify } from '../../src/utils/slug.ts'

export interface OpcoesOrganizar {
  nome: string
  descricao?: string
  /** Produtos a ligar à unidade: id do bloco, nome ou slug. */
  produtos: string[]
  /** Liga também todos os produtos que ainda não têm unidade. */
  semUnidade: boolean
  gravar: boolean
}

export interface ResultadoProduto {
  referencia: string
  id?: string
  nome?: string
  status: 'ligado' | 'ja-estava' | 'nao-encontrado' | 'outra-unidade'
}

export interface ResultadoOrganizar {
  unidadeId: string
  unidadeCriada: boolean
  produtos: ResultadoProduto[]
  /** Leitores com acesso por BU que passam a ver os produtos ligados. */
  usuariosAtualizados: number
}

const sem = (t: string) => slugify(t)

/**
 * Cria (ou reaproveita) uma unidade de negócio e liga produtos a ela. Rodar de
 * novo é seguro: a unidade tem id fixo (`u-<nome>`) e produtos já ligados são
 * só relatados. Um produto que já está em outra unidade não é movido: o
 * script avisa, e a troca é feita na tela do produto.
 */
export async function organizarUnidade(
  db: Firestore,
  opcoes: OpcoesOrganizar,
): Promise<ResultadoOrganizar> {
  const nome = opcoes.nome.trim()
  if (!nome) throw new Error('Informe o nome da unidade.')
  const unidadeId = `u-${slugify(nome)}`
  const unidadeRef = db.collection('unidades').doc(unidadeId)

  const [unidadeAtual, todas, raiz] = await Promise.all([
    unidadeRef.get(),
    db.collection('unidades').get(),
    db.collection('blocks').where('parentId', '==', null).get(),
  ])
  const produtosRaiz = raiz.docs.map((d) => ({
    id: d.id,
    nome: String(d.get('nome') ?? ''),
    slug: String(d.get('slug') ?? ''),
    unidadeId: (d.get('unidadeId') as string | null | undefined) ?? null,
  }))

  const resultados: ResultadoProduto[] = []
  const ligar = new Set<string>()
  const registrar = (p: (typeof produtosRaiz)[number], referencia: string) => {
    if (p.unidadeId === unidadeId) {
      resultados.push({
        referencia,
        id: p.id,
        nome: p.nome,
        status: 'ja-estava',
      })
    } else if (p.unidadeId) {
      resultados.push({
        referencia,
        id: p.id,
        nome: p.nome,
        status: 'outra-unidade',
      })
    } else {
      ligar.add(p.id)
      resultados.push({ referencia, id: p.id, nome: p.nome, status: 'ligado' })
    }
  }

  for (const ref of opcoes.produtos) {
    const alvo = produtosRaiz.find(
      (p) => p.id === ref || sem(p.nome) === sem(ref) || p.slug === sem(ref),
    )
    if (!alvo) resultados.push({ referencia: ref, status: 'nao-encontrado' })
    else registrar(alvo, ref)
  }
  if (opcoes.semUnidade) {
    const jaTratados = new Set(resultados.map((r) => r.id))
    for (const p of produtosRaiz) {
      if (!p.unidadeId && !jaTratados.has(p.id)) registrar(p, p.nome)
    }
  }

  // Quem tem acesso por BU (`unidadesPermitidas`) ganha os produtos ligados:
  // as regras leem `produtosPermitidos`, que precisa acompanhar a BU.
  const usuarios = await db.collection('users').get()
  const depois = produtosRaiz.map((p) => ({
    id: p.id,
    unidadeId: ligar.has(p.id) ? unidadeId : p.unidadeId,
  }))
  const idsDasUnidades = [
    ...new Set([...todas.docs.map((d) => d.id), unidadeId]),
  ]
  const acessos = usuarios.docs.flatMap((d) => {
    const liberadas = d.get('unidadesPermitidas') as unknown
    if (d.get('role') === 'admin' || !Array.isArray(liberadas)) return []
    const novos = produtosDasUnidades(
      liberadas as string[],
      depois,
      idsDasUnidades,
    )
    const atuais = d.get('produtosPermitidos') as string[] | undefined
    return mesmosIds(atuais, novos) ? [] : [{ ref: d.ref, novos }]
  })

  if (opcoes.gravar) {
    const batch = db.batch()
    if (!unidadeAtual.exists) {
      batch.set(unidadeRef, {
        nome,
        slug: slugify(nome),
        descricao: opcoes.descricao?.trim() ?? '',
        icone: '',
        ordem: todas.size,
      })
    }
    for (const id of ligar) {
      batch.update(db.collection('blocks').doc(id), { unidadeId })
    }
    for (const a of acessos) {
      batch.update(a.ref, { produtosPermitidos: a.novos })
    }
    await batch.commit()
  }

  return {
    unidadeId,
    unidadeCriada: !unidadeAtual.exists,
    produtos: resultados,
    usuariosAtualizados: acessos.length,
  }
}
