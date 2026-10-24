import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { checarUrl } from './http.ts'
import {
  relatorioEmMarkdown,
  verificarArtigos,
  type ArtigoParaVerificar,
} from './verificar.ts'

const AJUDA = `Uso: node scripts/verificar-links/index.ts --projeto <id> [opções]

Confere os links e as imagens dos artigos publicados: links internos para
artigos ou blocos que não existem mais (ou voltaram a rascunho) e endereços
externos que não respondem. Gera relatorio-links.md e .json.

  --projeto <id>      Projeto Firebase (ou FIREBASE_PROJECT_ID)
  --saida <pasta>     Onde salvar o relatório (padrão ./relatorio-links)
  --sem-externos      Só confere os links internos (não faz requisições HTTP)
  --concorrencia <n>  Requisições externas em paralelo (padrão 6)
  --estrito           Sai com código 1 se houver links quebrados

Credenciais: GOOGLE_APPLICATION_CREDENTIALS (ou FIRESTORE_EMULATOR_HOST).
`

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      projeto: { type: 'string' },
      saida: { type: 'string', default: 'relatorio-links' },
      'sem-externos': { type: 'boolean', default: false },
      concorrencia: { type: 'string', default: '6' },
      estrito: { type: 'boolean', default: false },
      ajuda: { type: 'boolean', default: false },
    },
  })
  if (values.ajuda) {
    console.log(AJUDA)
    return 0
  }
  const projeto = values.projeto ?? process.env.FIREBASE_PROJECT_ID
  if (!projeto) {
    console.error(
      'Informe o projeto com --projeto <id> (ou FIREBASE_PROJECT_ID).',
    )
    return 2
  }

  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: projeto }))
  const [artigosSnap, blocosSnap] = await Promise.all([
    db.collection('articles').get(),
    db.collection('blocks').select().get(),
  ])
  const artigos = artigosSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as ArtigoParaVerificar,
  )
  const relatorio = await verificarArtigos(artigos, {
    artigos: new Map(artigos.map((a) => [a.id, a.status])),
    blocos: new Set(blocosSnap.docs.map((d) => d.id)),
    checarUrl: values['sem-externos'] ? undefined : checarUrl,
    concorrencia: Number(values.concorrencia),
  })

  const md = relatorioEmMarkdown(relatorio)
  const saida = path.resolve(values.saida)
  await mkdir(saida, { recursive: true })
  await writeFile(path.join(saida, 'relatorio-links.md'), md)
  await writeFile(
    path.join(saida, 'relatorio-links.json'),
    JSON.stringify(relatorio, null, 2),
  )
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, md)

  console.log(
    `${relatorio.artigosVerificados} artigos, ${relatorio.urlsVerificadas} endereços externos: ` +
      `${relatorio.quebrados.length} quebrados, ${relatorio.inconclusivos.length} inconclusivos.`,
  )
  relatorio.quebrados
    .slice(0, 20)
    .forEach((a) => console.log(`  ✗ ${a.artigoId}: ${a.alvo} — ${a.motivo}`))
  console.log(`Relatório: ${path.join(saida, 'relatorio-links.md')}`)
  return values.estrito && relatorio.quebrados.length > 0 ? 1 : 0
}

main().then(
  (c) => process.exit(c),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
