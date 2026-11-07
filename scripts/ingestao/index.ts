import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs, promisify } from 'node:util'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, initializeFirestore } from 'firebase-admin/firestore'
import { criarResolvedorImagens } from '../migrate/images.ts'
import { criarVerificadorDeLinks } from '../migrate/links.ts'
import { ingerir } from './ingerir.ts'
import { observar } from './observar.ts'
import { relatorioDaIngestao } from './relatorio.ts'

const AJUDA = `Uso: node scripts/ingestao/index.ts <pasta> --produto <produto> [opções]

Lê os documentos de uma pasta (.md, .html e .txt) e os leva para o docs-hub,
sempre pela FILA DE REVISÃO: nada é publicado sozinho.

  arquivo novo         entra na fila de revisão, já com uma categoria e um
                       público sugeridos (por regras simples, sem IA)
  arquivo alterado     atualiza o item que ainda está na fila; se o artigo já
                       foi publicado (ou editado por uma pessoa), vira uma
                       SUGESTÃO pendente e a versão publicada continua no ar
  arquivo removido     marca o artigo para você decidir se despublica
  conteúdo repetido    não cria o artigo duas vezes (compara o hash)
  sem alteração        não é reprocessado
  erro                 fica registrado; rodar de novo tenta outra vez

Pastas dentro da origem viram subprodutos (blocos). Sem --gravar é só simulação.
Não lê .docx nem .pdf ainda: eles aparecem no relatório como ignorados.

  --produto <ref>      Produto de destino: id, nome ou slug (obrigatório)
  --bloco <id>         Subproduto (bloco) do produto que recebe os arquivos
  --fonte <nome>       Nome da origem (padrão: produto + nome da pasta)
  --projeto <id>       Projeto Firebase (ou FIREBASE_PROJECT_ID)
  --gravar             Grava no Firestore (sem isto, simulação)
  --sem-imagens        Não envia imagens; cada uma vira "[Imagem não migrada: …]"
  --verificar-links    Confere links externos por HTTP
  --rest               Grava por REST em vez de gRPC (redes com proxy/firewall)
  --autor <uid>        Autor gravado nos artigos (padrão: ingestao)
  --saida <pasta>      Relatório e cache de imagens (padrão: ./.ingestao)
  --estrito            Código de saída 1 se houver arquivos com erro
  --observar           Fica vigiando a pasta e sincroniza quando algo muda (Ctrl+C para
                       parar). Exige --gravar. O Firebase só é consultado quando a pasta
                       muda, então deixar rodando não gasta a cota
  --a-cada <min>       De quantos em quantos minutos conferir a pasta no --observar (padrão 2)
  --repo <nome>        Repositório de onde a pasta veio (aparece no painel e nos artigos)
  --commit <sha>       Commit da pasta (se a pasta for um checkout do Git, é descoberto sozinho)
  --modo <modo>        manual, observar ou git: como esta rodada foi disparada (no painel).
                       Padrão: observar com --observar, senão manual

Cloudinary (só com --gravar, dispensado com --sem-imagens): CLOUDINARY_CLOUD_NAME
e CLOUDINARY_UPLOAD_PRESET. Firestore: GOOGLE_APPLICATION_CREDENTIALS, ou
FIRESTORE_EMULATOR_HOST para testes.
`

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      produto: { type: 'string' },
      bloco: { type: 'string' },
      fonte: { type: 'string' },
      projeto: { type: 'string' },
      gravar: { type: 'boolean', default: false },
      'sem-imagens': { type: 'boolean', default: false },
      'verificar-links': { type: 'boolean', default: false },
      rest: { type: 'boolean', default: false },
      autor: { type: 'string', default: 'ingestao' },
      saida: { type: 'string' },
      estrito: { type: 'boolean', default: false },
      observar: { type: 'boolean', default: false },
      'a-cada': { type: 'string' },
      repo: { type: 'string' },
      commit: { type: 'string' },
      modo: { type: 'string' },
      ajuda: { type: 'boolean', default: false },
    },
  })
  const pasta = positionals[0]
  if (values.ajuda || !pasta) {
    console.log(AJUDA)
    return values.ajuda ? 0 : 2
  }
  if (!values.produto)
    return erro('Informe o produto com --produto <id, nome ou slug>.')
  const projeto =
    values.projeto ??
    process.env.FIREBASE_PROJECT_ID ??
    process.env.VITE_FIREBASE_PROJECT_ID
  if (!projeto)
    return erro('Informe o projeto com --projeto <id> (use o dev primeiro).')
  if (values.observar && !values.gravar) {
    return erro('O --observar grava a cada mudança: use junto com --gravar.')
  }
  const minutos = Number(values['a-cada'] ?? 2)
  if (!Number.isFinite(minutos) || minutos <= 0) {
    return erro('--a-cada precisa ser um número de minutos maior que zero.')
  }
  if (values.modo && !['manual', 'observar', 'git'].includes(values.modo)) {
    return erro('--modo precisa ser manual, observar ou git.')
  }
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME ?? process.env.VITE_CLOUDINARY_CLOUD_NAME
  const preset =
    process.env.CLOUDINARY_UPLOAD_PRESET ??
    process.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (values.gravar && !values['sem-imagens'] && (!cloudName || !preset)) {
    return erro(
      'Defina CLOUDINARY_CLOUD_NAME e CLOUDINARY_UPLOAD_PRESET, ou use --sem-imagens.',
    )
  }

  const baseDir = path.resolve(pasta)
  const saida = path.resolve(values.saida ?? '.ingestao')
  await mkdir(saida, { recursive: true })
  const arquivoCache = path.join(saida, 'cache-imagens.json')
  const cache = new Map<string, string>(
    Object.entries(
      await readFile(arquivoCache, 'utf8').then(JSON.parse, () => ({})),
    ) as Array<[string, string]>,
  )

  const app = getApps()[0] ?? initializeApp({ projectId: projeto })
  const db = values.rest
    ? initializeFirestore(app, { preferRest: true })
    : getFirestore(app)
  const modo = (values.modo ?? (values.observar ? 'observar' : 'manual')) as
    'manual' | 'observar' | 'git'
  const commit = values.commit ?? (await commitDaPasta(baseDir))

  async function rodar(): Promise<number> {
    const resultado = await ingerir(db, {
      pasta: baseDir,
      produto: values.produto as string,
      bloco: values.bloco,
      fonte: values.fonte,
      gravar: values.gravar,
      autorId: values.autor,
      agora: Date.now(),
      modo,
      repo: values.repo,
      commit,
      verificarLink: values['verificar-links']
        ? criarVerificadorDeLinks()
        : undefined,
      resolverImagem: criarResolvedorImagens({
        baseDir,
        cache,
        pular: values['sem-imagens'],
        cloudinary:
          values.gravar && !values['sem-imagens']
            ? { cloudName: cloudName as string, uploadPreset: preset as string }
            : null,
      }),
    })

    await writeFile(
      arquivoCache,
      JSON.stringify(Object.fromEntries(cache), null, 2),
    )
    await writeFile(
      path.join(saida, 'relatorio-ingestao.md'),
      relatorioDaIngestao(resultado, !values.gravar),
    )

    const c = resultado.contagem
    console.log(
      `${hora()} ${values.gravar ? 'Gravado' : 'Simulação'} (${resultado.fonteId}): ${c.novo} novos, ${c.alterado} alterados, ` +
        `${c['sem-alteracao']} sem alteração, ${c.duplicado} repetidos, ${c.removido} removidos, ` +
        `${c.reapareceu} reapareceram, ${c.erro} com erro, ${c.ignorado} ignorados.`,
    )
    return c.erro
  }

  if (values.observar) {
    const controle = new AbortController()
    process.on('SIGINT', () => {
      console.log('\nParando…')
      controle.abort()
    })
    console.log(
      `Vigiando ${baseDir} a cada ${minutos} min. Ctrl+C para parar. Nada é publicado: tudo cai na fila de revisão.`,
    )
    await observar({
      pasta: baseDir,
      intervaloMs: minutos * 60_000,
      sinal: controle.signal,
      executar: async () => void (await rodar()),
      aoErro: (e) =>
        console.error(
          `${hora()} Falhou, tento de novo na próxima volta: ${e instanceof Error ? e.message : e}`,
        ),
    })
    return 0
  }

  const comErro = await rodar()
  console.log(
    values.gravar
      ? 'Revise o que entrou na tela "Revisão" do docs-hub. Nada foi publicado.'
      : 'Nada foi gravado. Use --gravar para aplicar.',
  )
  console.log(`Relatório: ${path.join(saida, 'relatorio-ingestao.md')}`)
  return values.estrito && comErro > 0 ? 1 : 0
}

const hora = () => new Date().toLocaleTimeString('pt-BR')

/** Commit atual se a pasta for (ou estiver dentro de) um repositório Git; senão, nada. */
async function commitDaPasta(pasta: string): Promise<string | undefined> {
  try {
    const { stdout } = await promisify(execFile)(
      'git',
      ['-C', pasta, 'rev-parse', 'HEAD'],
      { timeout: 5000 },
    )
    return /^[0-9a-f]{7,64}$/.test(stdout.trim()) ? stdout.trim() : undefined
  } catch {
    return undefined
  }
}

function erro(msg: string): number {
  console.error(msg)
  return 2
}

main().then(
  (c) => process.exit(c),
  (e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  },
)
