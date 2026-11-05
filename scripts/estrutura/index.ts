import { parseArgs } from 'node:util'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { organizarUnidade } from './organizar.ts'

const AJUDA = `Uso: node scripts/estrutura/index.ts --projeto <id> --unidade <nome> [opções]

Cria uma unidade de negócio (BU) e liga produtos já existentes a ela. Rodar de
novo é seguro. Sem --gravar só mostra o que seria feito.

  --projeto <id>      Projeto Firebase (ou FIREBASE_PROJECT_ID)
  --unidade <nome>    Nome da unidade, ex.: "Process Solution"
  --descricao <txt>   Descrição da unidade (usada só ao criar)
  --produto <ref>     Produto a ligar: id, nome ou slug (repetível)
  --sem-unidade       Liga também todos os produtos que ainda não têm unidade
  --gravar            Grava (sem isto, é só simulação)

Credenciais: GOOGLE_APPLICATION_CREDENTIALS (ou FIRESTORE_EMULATOR_HOST).
`

const ROTULO = {
  ligado: 'será ligado',
  'ja-estava': 'já estava nesta unidade',
  'outra-unidade': 'está em OUTRA unidade (não foi alterado)',
  'nao-encontrado': 'NÃO ENCONTRADO',
} as const

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      projeto: { type: 'string' },
      unidade: { type: 'string' },
      descricao: { type: 'string' },
      produto: { type: 'string', multiple: true },
      'sem-unidade': { type: 'boolean', default: false },
      gravar: { type: 'boolean', default: false },
      ajuda: { type: 'boolean', default: false },
    },
  })
  if (values.ajuda) {
    console.log(AJUDA)
    return 0
  }
  const projeto = values.projeto ?? process.env.FIREBASE_PROJECT_ID
  if (!projeto) return erro('Informe o projeto com --projeto <id>.')
  if (!values.unidade) return erro('Informe o nome com --unidade <nome>.')
  if (!values.produto?.length && !values['sem-unidade'])
    return erro('Informe --produto <ref> ou --sem-unidade.')

  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: projeto }))
  const r = await organizarUnidade(db, {
    nome: values.unidade,
    descricao: values.descricao,
    produtos: values.produto ?? [],
    semUnidade: values['sem-unidade'],
    gravar: values.gravar,
  })

  console.log(
    `Unidade "${values.unidade}" (${r.unidadeId}): ${r.unidadeCriada ? 'será criada' : 'já existe'}`,
  )
  r.produtos.forEach((p) =>
    console.log(`  • ${p.nome ?? p.referencia}: ${ROTULO[p.status]}`),
  )
  const problemas = r.produtos.filter((p) => p.status === 'nao-encontrado')
  console.log(
    values.gravar
      ? '\nGravado.'
      : '\nSimulação: nada foi gravado. Use --gravar para aplicar.',
  )
  return problemas.length > 0 ? 1 : 0
}

function erro(msg: string): number {
  console.error(msg)
  return 2
}

main().then(
  (c) => process.exit(c),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
