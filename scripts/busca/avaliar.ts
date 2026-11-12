import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import {
  POSICOES,
  achou,
  lerCasosDeBusca,
  relatorioDaBusca,
  resumirBusca,
  rodarAvaliacaoDaBusca,
} from './avaliacao.ts'

const AJUDA = `Uso: node scripts/busca/avaliar.ts --casos <arquivo.json> --projeto <id> [opções]

Mede a taxa de acerto da busca com consultas reais que você escreveu: para cada
uma, diz em que produto buscar e qual artigo deveria aparecer. Roda no mesmo
motor da tela de busca (com os sinônimos do produto). Não usa IA e não gasta
nada: só lê o índice de busca dos produtos citados.

  --casos <arquivo>   JSON com os casos (exemplo: docs/avaliacao-busca.exemplo.json)
  --projeto <id>      Projeto Firebase (ou FIREBASE_PROJECT_ID)
  --sem-tecnico       Busca como um leitor que não vê artigos técnicos
  --minimo <0 a 1>    Taxa mínima de casos com o artigo certo entre os ${POSICOES} primeiros;
                      abaixo disso sai com código 1 (padrão 0.85)
  --saida <pasta>     Onde salvar o relatório (padrão ./.avaliacao)

Credenciais: GOOGLE_APPLICATION_CREDENTIALS (ou o Emulator).
`

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      casos: { type: 'string' },
      projeto: { type: 'string' },
      'sem-tecnico': { type: 'boolean', default: false },
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
  const minimo = Number(values.minimo ?? 0.85)
  if (!Number.isFinite(minimo) || minimo < 0 || minimo > 1) {
    return erro('--minimo precisa ser um número de 0 a 1 (ex.: 0.85).')
  }

  let bruto: unknown
  try {
    bruto = JSON.parse(await readFile(path.resolve(values.casos), 'utf8'))
  } catch (e) {
    return erro(
      `Não consegui ler ${values.casos}: ${e instanceof Error ? e.message : e}`,
    )
  }
  const lido = lerCasosDeBusca(bruto)
  if ('erros' in lido) {
    return erro(`Arquivo de casos inválido:\n  - ${lido.erros.join('\n  - ')}`)
  }
  const projeto = values.projeto ?? process.env.FIREBASE_PROJECT_ID
  if (!projeto) return erro('Informe o projeto com --projeto <id>.')

  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: projeto }))
  const resultados = await rodarAvaliacaoDaBusca(db, lido.casos, {
    verTecnico: !values['sem-tecnico'],
  })
  resultados.forEach((r, i) =>
    console.log(
      `[${i + 1}/${resultados.length}] ${achou(r) ? 'ok   ' : 'FALHOU'} ${r.caso.id}${
        r.erro
          ? ` — ${r.erro}`
          : r.posicao
            ? ` (posição ${r.posicao})`
            : ' (não apareceu)'
      }`,
    ),
  )

  const saida = path.resolve(values.saida ?? '.avaliacao')
  await mkdir(saida, { recursive: true })
  const arquivo = path.join(saida, 'avaliacao-busca.md')
  await writeFile(arquivo, relatorioDaBusca(resultados))
  const r = resumirBusca(resultados)
  console.log(
    `\n${r.achados} de ${r.total} casos com o artigo certo entre os ${POSICOES} primeiros (${Math.round(r.taxa * 100)}%); ${r.emPrimeiro} em primeiro lugar (${Math.round(r.taxaEmPrimeiro * 100)}%).`,
  )
  console.log(`Relatório: ${arquivo}`)
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
