import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'

const MAGIC = Buffer.from('DHBK1')
const SAL = 16
const IV = 12
const TAG = 16

function chave(senha: string, sal: Buffer): Buffer {
  return scryptSync(senha, sal, 32)
}

/** Comprime (gzip) e cifra (AES-256-GCM, chave derivada da senha com scrypt). */
export function cifrar(dados: Buffer, senha: string): Buffer {
  if (!senha) throw new Error('A senha de cifragem está vazia.')
  const sal = randomBytes(SAL)
  const iv = randomBytes(IV)
  const cifra = createCipheriv('aes-256-gcm', chave(senha, sal), iv)
  const corpo = Buffer.concat([cifra.update(gzipSync(dados)), cifra.final()])
  return Buffer.concat([MAGIC, sal, iv, cifra.getAuthTag(), corpo])
}

export function decifrar(arquivo: Buffer, senha: string): Buffer {
  if (!arquivo.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Arquivo não é um backup cifrado do docs-hub.')
  }
  let pos = MAGIC.length
  const sal = arquivo.subarray(pos, (pos += SAL))
  const iv = arquivo.subarray(pos, (pos += IV))
  const tag = arquivo.subarray(pos, (pos += TAG))
  const decifra = createDecipheriv('aes-256-gcm', chave(senha, sal), iv)
  decifra.setAuthTag(tag)
  try {
    return gunzipSync(
      Buffer.concat([decifra.update(arquivo.subarray(pos)), decifra.final()]),
    )
  } catch {
    throw new Error('Senha incorreta ou arquivo corrompido.')
  }
}
