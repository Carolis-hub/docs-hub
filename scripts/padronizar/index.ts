import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { ArticleStatus } from '../../src/types/content.ts'
import { MODELO_PADRAO, criarProvedorAnthropic } from './ia.ts'
import { lerPadrao, padronizar } from './padronizar.ts'

const PADRAO_ARQUIVO = 'docs/padrao-de-manual.md'
const ESTADOS: ArticleStatus[] = [
  'draft',
  'review',
  'approved',
  'published',
  'rejected',
  'archived',
]

const AJUDA = `Uso: node scripts/padronizar/index.ts --produto <ref> [opções]

Confere os artigos de um produto com o padrão de manual de usuário
(${PADRAO_ARQUIVO}) e, com --ia, pede à IA uma reescrita no padrão. Nunca
publica nem altera o artigo: grava só em articles/{id}/suggestions, para um
admin revisar na tela "Sugestões" do docs-hub.

Sem --ia roda só a conferência local (sem custo, sem chave de IA).

  --produto <ref>       Produto: id, nome ou slug (obrigatório)
  --bloco <ref>         Só este subproduto/módulo (e o que está abaixo dele)
  --artigo <id>         Artigo específico (repetível); ignora --status e --bloco
  --status <lista>      Estados considerados, separados por vírgula
                        (padrão: review; opções: ${ESTADOS.join(', ')})
  --limite <n>          Máximo de artigos tratados por execução (padrão 10;
                        os com mais problemas vêm primeiro)
  --min-problemas <n>   Só trata artigos com pelo menos n problemas (padrão 1)
  --ia                  Chama a IA (gasta cota; sem --gravar só relata)
  --gravar              Com --ia, grava as sugestões
  --padrao <arquivo>    Outro arquivo de padrão (padrão: ${PADRAO_ARQUIVO})
  --projeto <id>        Projeto Firebase (ou FIREBASE_PROJECT_ID)
  --modelo <id>         Modelo da IA (padrão ${MODELO_PADRAO}, ou PADRONIZAR_MODEL)

Credenciais: GOOGLE_APPLICATION_CREDENTIALS (ou FIRESTORE_EMULATOR_HOST em
testes) e, com --ia, ANTHROPIC_API_KEY.
`

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      produto: { type: 'string' },
      bloco: { type: 'string' },
      artigo: { type: 'string', multiple: true },
      status: { type: 'string' },
      limite: { type: 'string' },
      'min-problemas': { type: 'string' },
      ia: { type: 'boolean', default: false },
      gravar: { type: 'boolean', default: false },
      padrao: { type: 'string' },
      projeto: { type: 'string' },
      modelo: { type: 'string' },
      ajuda: { type: 'boolean', default: false },
    },
  })
  if (values.ajuda) {
    console.log(AJUDA)
    return 0
  }
  if (!values.produto) {
    console.error(AJUDA)
    return 2
  }
  const projeto = values.projeto ?? process.env.FIREBASE_PROJECT_ID
  if (!projeto) {
    console.error(
      'Informe o projeto com --projeto <id> (ou FIREBASE_PROJECT_ID).',
    )
    return 2
  }
  if (values.gravar && !values.ia) {
    console.error('--gravar só vale junto com --ia.')
    return 2
  }
  if (values.ia && !process.env.ANTHROPIC_API_KEY) {
    console.error('Com --ia, defina ANTHROPIC_API_KEY.')
    return 2
  }
  const status = (values.status ?? 'review')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as ArticleStatus[]
  const invalido = status.find((s) => !ESTADOS.includes(s))
  if (invalido || status.length === 0 || status.length > 10) {
    console.error(`Estado inválido: ${invalido ?? '(vazio)'}.`)
    return 2
  }
  const numero = (v: string | undefined, padrao: number) =>
    v === undefined ? padrao : Number(v)
  const limite = numero(values.limite, 10)
  const minProblemas = numero(values['min-problemas'], 1)
  if (
    !Number.isInteger(limite) ||
    limite < 1 ||
    !Number.isFinite(minProblemas)
  ) {
    console.error('--limite e --min-problemas precisam ser números válidos.')
    return 2
  }

  const arquivoPadrao = values.padrao ?? PADRAO_ARQUIVO
  const padrao = lerPadrao(
    arquivoPadrao,
    await readFile(path.resolve(arquivoPadrao), 'utf8'),
  )
  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: projeto }))
  const provedor = values.ia
    ? criarProvedorAnthropic({ modelo: values.modelo })
    : null

  const r = await padronizar(db, padrao, provedor, {
    produto: values.produto,
    bloco: values.bloco,
    artigos: values.artigo,
    status,
    limite,
    minProblemas,
    usarIA: values.ia,
    gravar: values.gravar,
    agora: Date.now(),
  })

  console.log(
    `\n${r.produto}: ${r.total} artigo(s) conferido(s) (${status.join(', ')}); ${r.semProblemas} sem problemas.`,
  )
  let falhas = 0
  for (const x of r.resultados) {
    console.log(`\n${x.titulo} (${x.artigoId}): ${x.status}`)
    for (const p of x.problemas) console.log(`  - ${p.mensagem}`)
    if (x.detalhe) console.log(`  ${x.detalhe}`)
    for (const m of x.mudancas ?? []) console.log(`  + ${m}`)
    for (const a of x.avisos ?? []) console.log(`  ! ${a}`)
    if (x.status === 'erro') falhas++
  }
  if (r.alemDoLimite > 0) {
    console.log(
      `\n${r.alemDoLimite} artigo(s) com problemas ficaram de fora pelo --limite; rode de novo para os próximos.`,
    )
  }
  if (!values.ia) {
    console.log('\nSó conferência local. Use --ia para pedir a reescrita à IA.')
  } else if (!values.gravar) {
    console.log(
      '\nSimulação: nada foi gravado. Use --gravar para criar as sugestões.',
    )
  }
  return falhas > 0 ? 1 : 0
}

main().then(
  (c) => process.exit(c),
  (e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  },
)
