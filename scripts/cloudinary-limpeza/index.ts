import { appendFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { JSONContent } from '@tiptap/react'
import {
  apagarImagens,
  listarImagens,
  type CredenciaisCloudinary,
} from './cloudinary.ts'
import {
  idsReferenciados,
  motivoParaNaoApagar,
  planejarLimpeza,
} from './limpeza.ts'

const AJUDA = `Uso: node scripts/cloudinary-limpeza/index.ts --projeto <id> [opções]

Acha imagens do Cloudinary que nenhum artigo usa e, se pedido, apaga. Uma
imagem conta como usada se aparece no artigo atual, em qualquer versão do
histórico ou em sugestão pendente da IA.

  --projeto <id>     Projeto Firebase (ou FIREBASE_PROJECT_ID)
  --apagar           Apaga de verdade (sem isto é só relatório)
  --carencia <dias>  Não apaga imagens com menos de N dias (padrão 7)
  --pasta <nome>     Só considera imagens desta pasta (ou CLOUDINARY_FOLDER)
  --forcar           Ignora as travas de segurança

Cloudinary: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
Firestore: GOOGLE_APPLICATION_CREDENTIALS (ou FIRESTORE_EMULATOR_HOST).
`

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      projeto: { type: 'string' },
      apagar: { type: 'boolean', default: false },
      carencia: { type: 'string', default: '7' },
      pasta: { type: 'string' },
      forcar: { type: 'boolean', default: false },
      ajuda: { type: 'boolean', default: false },
    },
  })
  if (values.ajuda) {
    console.log(AJUDA)
    return 0
  }
  const projeto = values.projeto ?? process.env.FIREBASE_PROJECT_ID
  const {
    CLOUDINARY_CLOUD_NAME: cloudName,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: apiSecret,
  } = process.env
  if (!projeto)
    return erro(
      'Informe o projeto com --projeto <id> (ou FIREBASE_PROJECT_ID).',
    )
  if (!cloudName || !apiKey || !apiSecret) {
    return erro(
      'Defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET.',
    )
  }
  const cred: CredenciaisCloudinary = { cloudName, apiKey, apiSecret }

  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: projeto }))
  const conteudos: JSONContent[] = []
  const artigos = await db.collection('articles').get()
  for (const a of artigos.docs) {
    conteudos.push(a.data().conteudo as JSONContent)
    for (const v of (await a.ref.collection('versions').get()).docs) {
      conteudos.push(v.data().conteudo as JSONContent)
    }
    const pendentes = await a.ref
      .collection('suggestions')
      .where('status', '==', 'pending')
      .get()
    pendentes.docs.forEach((s) =>
      conteudos.push(s.data().conteudo as JSONContent),
    )
  }

  const recursos = await listarImagens(
    cred,
    values.pasta ?? process.env.CLOUDINARY_FOLDER,
  )
  const referenciados = idsReferenciados(conteudos.filter(Boolean), cloudName)
  const plano = planejarLimpeza(recursos, referenciados, {
    carenciaDias: Number(values.carencia),
    agora: new Date(),
  })

  const linhas = [
    `Imagens no Cloudinary: ${plano.total}`,
    `Em uso: ${plano.referenciadas}`,
    `Órfãs há mais de ${values.carencia} dias: ${plano.orfas.length} (${(plano.bytesLiberados / 1024 / 1024).toFixed(1)} MB)`,
    `Órfãs recentes (em carência): ${plano.emCarencia}`,
  ]
  console.log(linhas.join('\n'))
  plano.orfas.slice(0, 50).forEach((r) => console.log(`  - ${r.public_id}`))
  if (plano.orfas.length > 50)
    console.log(`  … e mais ${plano.orfas.length - 50}`)

  let apagadas = 0
  if (values.apagar && plano.orfas.length > 0) {
    const motivo = values.forcar
      ? null
      : motivoParaNaoApagar(plano, artigos.size)
    if (motivo) {
      console.error(`Nada foi apagado: ${motivo}. Revise, ou use --forcar.`)
      await resumo([...linhas, `**Nada apagado:** ${motivo}`])
      return 1
    }
    apagadas = await apagarImagens(
      cred,
      plano.orfas.map((r) => r.public_id),
    )
    console.log(`Apagadas: ${apagadas}`)
  } else if (!values.apagar) {
    console.log('Relatório apenas. Use --apagar para remover as órfãs.')
  }
  await resumo([
    ...linhas,
    values.apagar
      ? `Apagadas: ${apagadas}`
      : '_Somente relatório, nada foi apagado._',
  ])
  return 0
}

function erro(msg: string): number {
  console.error(msg)
  return 2
}

/** Escreve no resumo da execução do GitHub Actions, quando existir. */
async function resumo(linhas: string[]): Promise<void> {
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Limpeza do Cloudinary\n\n${linhas.map((l) => `- ${l}`).join('\n')}\n`,
    )
  }
}

main().then(
  (c) => process.exit(c),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
