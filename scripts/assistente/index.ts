import { createServer } from 'node:http'
import { parseArgs } from 'node:util'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { configDoAmbiente } from './config.ts'
import { tratarRequisicao } from './http.ts'
import {
  criarProvedorDaConfig,
  criarProvedorSemChave,
  temChaveNoAmbiente,
} from './ia.ts'

const AJUDA = `Uso: node scripts/assistente/index.ts --projeto <id> [opções]

Sobe o servidor do assistente de IA. O navegador não pode guardar a chave da
Anthropic, então as perguntas passam por este servidor: ele confere quem está
perguntando (login do Firebase), lê só a documentação a que a pessoa tem acesso,
chama a IA e controla o gasto.

  --projeto <id>    Projeto Firebase (ou FIREBASE_PROJECT_ID)
  --porta <n>       Porta do servidor (padrão 8787, ou PORT)
  --origem <url>    Endereço do sistema autorizado a chamar (padrão http://localhost:5173);
                    repita a opção para liberar mais de um

Variáveis: ASSISTENTE_PROVEDOR (anthropic, o padrão, ou groq), ANTHROPIC_API_KEY
ou GROQ_API_KEY conforme o provedor (opcional: sem ela, cada usuário informa a
sua em Minhas preferências), GOOGLE_APPLICATION_CREDENTIALS (ou o
Emulator: FIRESTORE_EMULATOR_HOST e FIREBASE_AUTH_EMULATOR_HOST).
Limites e modelos: ASSISTENTE_MODELO, ASSISTENTE_MODELO_BUSCA,
ASSISTENTE_PERGUNTAS_POR_DIA, ASSISTENTE_ORCAMENTO_DIARIO_USD,
ASSISTENTE_MAX_FONTES, ASSISTENTE_MAX_CANDIDATOS, ASSISTENTE_MAX_CARACTERES_FONTE.

No sistema, defina VITE_ASSISTENTE_URL com o endereço deste servidor
(ex.: http://localhost:8787) e reinicie o npm run dev.
`

async function lerCorpo(
  req: import('node:http').IncomingMessage,
): Promise<unknown> {
  const partes: Buffer[] = []
  let total = 0
  for await (const p of req) {
    total += (p as Buffer).length
    if (total > 100_000) throw new Error('corpo grande demais')
    partes.push(p as Buffer)
  }
  const texto = Buffer.concat(partes).toString('utf8')
  return texto ? JSON.parse(texto) : {}
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      projeto: { type: 'string' },
      porta: { type: 'string' },
      origem: { type: 'string', multiple: true },
      ajuda: { type: 'boolean', default: false },
    },
  })
  if (values.ajuda) {
    console.log(AJUDA)
    return 0
  }
  const projeto = values.projeto ?? process.env.FIREBASE_PROJECT_ID
  if (!projeto) {
    console.error('Informe o projeto com --projeto <id>.')
    return 2
  }
  const config = configDoAmbiente()
  const nomeDaChave =
    config.provedor === 'groq' ? 'GROQ_API_KEY' : 'ANTHROPIC_API_KEY'
  const chaveDoServidor = temChaveNoAmbiente(config.provedor)
  if (!chaveDoServidor) {
    console.warn(
      `${nomeDaChave} não definida: cada usuário precisará informar a sua chave em Minhas preferências.`,
    )
  }
  const porta = Number(values.porta ?? process.env.PORT ?? 8787)
  const origens = new Set(
    values.origem?.length ? values.origem : ['http://localhost:5173'],
  )

  const app = getApps()[0] ?? initializeApp({ projectId: projeto })
  const deps = {
    db: getFirestore(app),
    config,
    ia: chaveDoServidor
      ? criarProvedorDaConfig(config)
      : criarProvedorSemChave(),
    criarProvedor: (apiKey: string) => criarProvedorDaConfig(config, apiKey),
    verificarToken: async (t: string) =>
      (await getAuth(app).verifyIdToken(t)).uid,
  }

  createServer((req, res) => {
    const origem = req.headers.origin
    const cabecalhos: Record<string, string> = {
      'Content-Type': 'application/json; charset=utf-8',
      Vary: 'Origin',
    }
    if (origem && origens.has(origem)) {
      cabecalhos['Access-Control-Allow-Origin'] = origem
      cabecalhos['Access-Control-Allow-Headers'] =
        'authorization, content-type, x-chave-ia'
      cabecalhos['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cabecalhos).end()
      return
    }
    void (async () => {
      try {
        const corpo = await lerCorpo(req).catch(() => ({}))
        const r = await tratarRequisicao(deps, {
          metodo: req.method ?? 'GET',
          authorization: req.headers.authorization,
          chaveIA: req.headers['x-chave-ia']?.toString(),
          corpo,
        })
        res.writeHead(r.status, cabecalhos).end(JSON.stringify(r.corpo))
      } catch (e) {
        console.error('assistente:', e)
        res.writeHead(500, cabecalhos).end(
          JSON.stringify({
            erro: { codigo: 'erro-interno', mensagem: 'Erro interno.' },
          }),
        )
      }
    })()
  }).listen(porta, () => {
    console.log(
      `Assistente no ar em http://localhost:${porta} (projeto ${projeto}).`,
    )
    console.log(`Origens liberadas: ${[...origens].join(', ')}`)
    console.log(
      `Provedor: ${config.provedor} · Modelo: ${config.modelo} (busca: ${config.modeloBusca}) · ${config.perguntasPorUsuarioDia} perguntas/dia por pessoa · teto US$ ${config.orcamentoDiarioUsd}/dia`,
    )
  })
  return -1
}

main().then(
  (c) => {
    if (c >= 0) process.exit(c)
  },
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
