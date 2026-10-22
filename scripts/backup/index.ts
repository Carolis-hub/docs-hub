import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { exportarFirestore } from './backup.ts'
import { cifrar } from './cripto.ts'

const AJUDA = `Uso: node scripts/backup/index.ts --projeto <id> [opções]

Exporta o Firestore inteiro (coleções e subcoleções) em JSON, comprimido e
cifrado. As chaves de IA dos usuários (users.*.aiKey) nunca entram no arquivo.

  --projeto <id>   Projeto Firebase (ou FIREBASE_PROJECT_ID)
  --saida <pasta>  Onde salvar (padrão ./backups)
  --sem-cifra      Grava o JSON puro, sem cifrar nem comprimir (só para uso local)

Cifragem: defina BACKUP_PASSPHRASE. Credenciais: GOOGLE_APPLICATION_CREDENTIALS
(ou FIRESTORE_EMULATOR_HOST para testes). As imagens ficam no Cloudinary e não
fazem parte deste backup.
`

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      projeto: { type: 'string' },
      saida: { type: 'string', default: 'backups' },
      'sem-cifra': { type: 'boolean', default: false },
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
  const senha = process.env.BACKUP_PASSPHRASE
  if (!values['sem-cifra'] && !senha) {
    console.error(
      'Defina BACKUP_PASSPHRASE para cifrar o backup (ou use --sem-cifra, só localmente).',
    )
    return 2
  }

  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: projeto }))
  const agora = new Date()
  const backup = await exportarFirestore(db, projeto, agora)
  const json = Buffer.from(JSON.stringify(backup))
  const base = `docs-hub-${projeto}-${agora.toISOString().slice(0, 10)}.json`
  const arquivo = values['sem-cifra'] ? base : `${base}.gz.enc`
  const destino = path.resolve(values.saida, arquivo)
  await mkdir(path.dirname(destino), { recursive: true })
  await writeFile(
    destino,
    values['sem-cifra'] ? json : cifrar(json, senha as string),
    { mode: 0o600 },
  )
  console.log(
    `Backup de ${projeto}: ${backup.documentos.length} documentos → ${destino}`,
  )
  if (backup.redigidos.length)
    console.log(`Campos removidos: ${backup.redigidos.join(', ')}`)
  return 0
}

main().then(
  (c) => process.exit(c),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
