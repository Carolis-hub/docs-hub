import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { configDoAmbiente } from './config.ts'
import { criarProvedorDaConfig, temChaveNoAmbiente } from './ia.ts'
import {
  lerCasos,
  relatorioDaAvaliacao,
  resumir,
  rodarAvaliacao,
} from './qualidade.ts'

const AJUDA = `Uso: node scripts/assistente/avaliar.ts --casos <arquivo.json> [opções]

Mede a qualidade do assistente com um conjunto de perguntas que você escreveu:
para cada uma, diz qual artigo deveria ser citado, que termos a resposta deve
trazer (e quais não pode trazer) e se a documentação de fato a responde. Roda o
assistente de verdade, então GASTA com a IA: sem --executar ele só confere o
arquivo e diz quantas chamadas faria.

  --casos <arquivo>   JSON com os casos (exemplo: docs/avaliacao-assistente.exemplo.json)
  --como <uid>        Usuário em nome de quem perguntar (obrigatório com --executar): vale o
                      acesso dele, ou seja, os produtos permitidos e o conteúdo técnico
  --projeto <id>      Projeto Firebase (ou FIREBASE_PROJECT_ID)
  --executar          Roda de verdade (pede a chave do provedor e gasta cota)
  --minimo <0 a 1>    Taxa mínima de casos aprovados; abaixo disso sai com código 1 (padrão 0.8)
  --saida <pasta>     Onde salvar o relatório (padrão ./.avaliacao)

Não mexe na cota nem no registro de perguntas reais (nem aparece em "Uso da IA").
Credenciais: GOOGLE_APPLICATION_CREDENTIALS (ou o Emulator).
`

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      casos: { type: 'string' },
      como: { type: 'string' },
      projeto: { type: 'string' },
      executar: { type: 'boolean', default: false },
      minimo: { type: 'string' },
      saida: { type: 'string' },
      ajuda: { type: 'boolean', default: false },
    },
  })
  if (values.ajuda) {
    console.log(AJUDA)
    return 0
  }
  if (!values.casos)
    return erro('Informe o arquivo com --casos <arquivo.json>.')
  const minimo = Number(values.minimo ?? 0.8)
  if (!Number.isFinite(minimo) || minimo < 0 || minimo > 1) {
    return erro('--minimo precisa ser um número de 0 a 1 (ex.: 0.8).')
  }

  let bruto: unknown
  try {
    bruto = JSON.parse(await readFile(path.resolve(values.casos), 'utf8'))
  } catch (e) {
    return erro(
      `Não consegui ler ${values.casos}: ${e instanceof Error ? e.message : e}`,
    )
  }
  const lido = lerCasos(bruto)
  if ('erros' in lido) {
    return erro(`Arquivo de casos inválido:\n  - ${lido.erros.join('\n  - ')}`)
  }
  const { casos } = lido
  const recusas = casos.filter((c) => !c.deveEncontrar).length
  console.log(
    `${casos.length} caso(s) (${recusas} de recusa). Cada pergunta faz até 3 chamadas à IA: até ${casos.length * 3} no total.`,
  )

  if (!values.executar) {
    console.log(
      'Nada foi executado. Use --executar para rodar de verdade (gasta com a IA).',
    )
    return 0
  }
  const projeto = values.projeto ?? process.env.FIREBASE_PROJECT_ID
  if (!projeto) return erro('Informe o projeto com --projeto <id>.')
  if (!values.como)
    return erro(
      'Informe com --como <uid> quem vai "perguntar" (vale o acesso dele).',
    )
  const config = configDoAmbiente()
  if (!temChaveNoAmbiente(config.provedor)) {
    return erro(
      config.provedor === 'groq'
        ? 'Defina GROQ_API_KEY.'
        : 'Defina ANTHROPIC_API_KEY.',
    )
  }
  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: projeto }))
  const resultados = await rodarAvaliacao(
    {
      db,
      config,
      ia: criarProvedorDaConfig(config),
    },
    values.como,
    casos,
    (r, i) =>
      console.log(
        `[${i + 1}/${casos.length}] ${r.passou ? 'ok   ' : 'FALHOU'} ${r.caso.id} (${r.ms} ms)${r.erro ? ` — ${r.erro}` : ''}`,
      ),
  )

  const saida = path.resolve(values.saida ?? '.avaliacao')
  await mkdir(saida, { recursive: true })
  await writeFile(
    path.join(saida, 'avaliacao.md'),
    relatorioDaAvaliacao(resultados),
  )
  const r = resumir(resultados)
  console.log(
    `\n${r.passaram} de ${r.total} casos aprovados (${Math.round(r.taxa * 100)}%). Gasto estimado: US$ ${r.custoUsd.toFixed(4)}.`,
  )
  console.log(`Relatório: ${path.join(saida, 'avaliacao.md')}`)
  if (r.taxa < minimo) {
    console.error(`Abaixo do mínimo de ${Math.round(minimo * 100)}%.`)
    return 1
  }
  return 0
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
