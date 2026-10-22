import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { restaurar, type ArquivoBackup } from './backup.ts'
import { decifrar } from './cripto.ts'

const AJUDA = `Uso: node scripts/backup/restaurar.ts <arquivo> --projeto <id> [opções]

Restaura um backup gerado por scripts/backup. Por padrão é uma simulação: só
conta o que seria gravado.

  --projeto <id>   Projeto Firebase de destino (ou FIREBASE_PROJECT_ID)
  --gravar         Grava de verdade
  --sobrescrever   Substitui documentos que já existem (o padrão os preserva)

Arquivos .enc pedem BACKUP_PASSPHRASE. Restaure primeiro no projeto dev.
`

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      projeto: { type: 'string' },
      gravar: { type: 'boolean', default: false },
      sobrescrever: { type: 'boolean', default: false },
      ajuda: { type: 'boolean', default: false },
    },
  })
  const arquivo = positionals[0]
  if (values.ajuda || !arquivo) {
    console.log(AJUDA)
    return values.ajuda ? 0 : 2
  }
  const projeto = values.projeto ?? process.env.FIREBASE_PROJECT_ID
  if (!projeto) {
    console.error('Informe o projeto de destino com --projeto <id>.')
    return 2
  }
  let bruto: Buffer = await readFile(path.resolve(arquivo))
  if (arquivo.endsWith('.enc')) {
    if (!process.env.BACKUP_PASSPHRASE) {
      console.error('Defina BACKUP_PASSPHRASE para abrir o backup cifrado.')
      return 2
    }
    bruto = decifrar(bruto, process.env.BACKUP_PASSPHRASE)
  }
  const backup = JSON.parse(bruto.toString('utf8')) as ArquivoBackup
  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: projeto }))
  const r = await restaurar(db, backup, {
    gravar: values.gravar,
    sobrescrever: values.sobrescrever,
  })
  console.log(
    `${values.gravar ? 'Restaurado' : 'Simulação'} em ${projeto} (backup de ${backup.projeto}, ${backup.geradoEm}): ` +
      `${r.gravados} documentos ${values.gravar ? 'gravados' : 'seriam gravados'}, ${r.pulados} já existiam.`,
  )
  if (!values.gravar) console.log('Use --gravar para aplicar.')
  return 0
}

main().then(
  (c) => process.exit(c),
  (e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  },
)
