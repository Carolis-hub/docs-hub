import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { MODELO_PADRAO, criarProvedorAnthropic } from './ia.ts'
import { lerRegras } from './regras.ts'
import { sincronizarRegras } from './sincronizar.ts'

const AJUDA = `Uso: node scripts/doc-sync/index.ts <regras.md>... [opções]

Lê arquivos .md com as regras de um produto ou funcionalidade e pede à IA uma
sugestão de atualização dos artigos correspondentes. Nunca publica: grava só em
articles/{id}/suggestions, para um admin revisar no docs-hub.

  --gravar              Grava as sugestões (sem isto, roda a IA e só relata)
  --projeto <id>        Projeto Firebase (ou FIREBASE_PROJECT_ID)
  --artigo <id>         Artigo a atualizar (repetível); soma-se ao front matter
  --produto <id>        Produto onde buscar artigos parecidos, se nenhum for indicado
  --max <n>             Máximo de artigos na busca automática (padrão 3)
  --modelo <id>         Modelo da IA (padrão ${MODELO_PADRAO}, ou DOC_SYNC_MODEL)
  --repo <dono/nome>    Repositório de origem das regras (só para rastrear)
  --commit <sha>        Commit de origem das regras (só para rastrear)

Credenciais: ANTHROPIC_API_KEY e GOOGLE_APPLICATION_CREDENTIALS (ou
FIRESTORE_EMULATOR_HOST para testes).
`

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      gravar: { type: 'boolean', default: false },
      projeto: { type: 'string' },
      artigo: { type: 'string', multiple: true },
      produto: { type: 'string' },
      max: { type: 'string' },
      modelo: { type: 'string' },
      repo: { type: 'string' },
      commit: { type: 'string' },
      ajuda: { type: 'boolean', default: false },
    },
  })
  if (values.ajuda || positionals.length === 0) {
    console.log(AJUDA)
    return values.ajuda ? 0 : 2
  }
  const projeto = values.projeto ?? process.env.FIREBASE_PROJECT_ID
  if (!projeto) {
    console.error(
      'Informe o projeto com --projeto <id> (ou FIREBASE_PROJECT_ID).',
    )
    return 2
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Defina ANTHROPIC_API_KEY.')
    return 2
  }

  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: projeto }))
  const provedor = criarProvedorAnthropic({ modelo: values.modelo })
  let falhas = 0

  for (const arquivo of positionals) {
    const regras = lerRegras(
      arquivo,
      await readFile(path.resolve(arquivo), 'utf8'),
    )
    console.log(`\n${arquivo} — "${regras.titulo}"`)
    const r = await sincronizarRegras(db, regras, provedor, {
      artigos: values.artigo,
      produto: values.produto,
      maxCandidatos: values.max ? Number(values.max) : undefined,
      gravar: values.gravar,
      origem: { repo: values.repo, commit: values.commit },
      agora: Date.now(),
    })
    if (r.semArtigo) console.warn(`  aviso: ${r.semArtigo}`)
    for (const x of r.resultados) {
      const auto = x.automatico ? ' (busca automática)' : ''
      console.log(
        `  ${x.artigoId}${auto}: ${x.status}${x.detalhe ? ` — ${x.detalhe}` : ''}`,
      )
      if (x.status === 'erro' || x.status === 'artigo-nao-encontrado') falhas++
    }
  }
  if (!values.gravar)
    console.log(
      '\nSimulação: nada foi gravado. Use --gravar para criar as sugestões.',
    )
  return falhas > 0 ? 1 : 0
}

main().then(
  (c) => process.exit(c),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
