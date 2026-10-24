import {
  DocumentReference,
  GeoPoint,
  Timestamp,
  type CollectionReference,
  type Firestore,
} from 'firebase-admin/firestore'

export interface DocumentoBackup {
  caminho: string
  dados: Record<string, unknown>
}

export interface ArquivoBackup {
  formato: 'docs-hub-backup/1'
  projeto: string
  geradoEm: string
  /** Campos removidos por conterem segredos (ex.: chave de IA do usuário). */
  redigidos: string[]
  documentos: DocumentoBackup[]
}

/** Campos que nunca entram no backup, por coleção de primeiro nível. */
const SEGREDOS: Record<string, string[]> = { users: ['aiKey'] }

const TIPO = '__tipo'

/** Converte os tipos especiais do Firestore em JSON que dá para restaurar. */
export function paraJson(valor: unknown): unknown {
  if (valor instanceof Timestamp) {
    return {
      [TIPO]: 'timestamp',
      segundos: valor.seconds,
      nanos: valor.nanoseconds,
    }
  }
  if (valor instanceof GeoPoint) {
    return {
      [TIPO]: 'geopoint',
      latitude: valor.latitude,
      longitude: valor.longitude,
    }
  }
  if (valor instanceof DocumentReference)
    return { [TIPO]: 'ref', caminho: valor.path }
  if (Buffer.isBuffer(valor) || valor instanceof Uint8Array) {
    return { [TIPO]: 'bytes', base64: Buffer.from(valor).toString('base64') }
  }
  if (Array.isArray(valor)) return valor.map(paraJson)
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, paraJson(v)]),
    )
  }
  return valor
}

/** Inverso de `paraJson`. */
export function deJson(valor: unknown, db: Firestore): unknown {
  if (Array.isArray(valor)) return valor.map((v) => deJson(v, db))
  if (valor && typeof valor === 'object') {
    const o = valor as Record<string, unknown>
    switch (o[TIPO]) {
      case 'timestamp':
        return new Timestamp(o.segundos as number, o.nanos as number)
      case 'geopoint':
        return new GeoPoint(o.latitude as number, o.longitude as number)
      case 'ref':
        return db.doc(o.caminho as string)
      case 'bytes':
        return Buffer.from(o.base64 as string, 'base64')
    }
    return Object.fromEntries(
      Object.entries(o).map(([k, v]) => [k, deJson(v, db)]),
    )
  }
  return valor
}

async function percorrer(
  colecao: CollectionReference,
  saida: DocumentoBackup[],
  redigidos: Set<string>,
): Promise<void> {
  const raiz = colecao.path.split('/')[0] as string
  const docs = await colecao.get()
  for (const d of docs.docs) {
    const dados = { ...d.data() }
    for (const campo of SEGREDOS[raiz] ?? []) {
      if (campo in dados) {
        delete dados[campo]
        redigidos.add(`${raiz}.*.${campo}`)
      }
    }
    saida.push({
      caminho: d.ref.path,
      dados: paraJson(dados) as Record<string, unknown>,
    })
    for (const sub of await d.ref.listCollections()) {
      await percorrer(sub, saida, redigidos)
    }
  }
}

/** Lê o Firestore inteiro (coleções e subcoleções) para um objeto serializável. */
export async function exportarFirestore(
  db: Firestore,
  projeto: string,
  agora: Date,
): Promise<ArquivoBackup> {
  const documentos: DocumentoBackup[] = []
  const redigidos = new Set<string>()
  for (const colecao of await db.listCollections()) {
    await percorrer(colecao, documentos, redigidos)
  }
  return {
    formato: 'docs-hub-backup/1',
    projeto,
    geradoEm: agora.toISOString(),
    redigidos: [...redigidos].sort(),
    documentos,
  }
}

export interface ResultadoRestauro {
  gravados: number
  pulados: number
}

/** Restaura os documentos. Sem `sobrescrever`, o que já existe é preservado. */
export async function restaurar(
  db: Firestore,
  backup: ArquivoBackup,
  opcoes: { gravar: boolean; sobrescrever: boolean },
): Promise<ResultadoRestauro> {
  if (backup.formato !== 'docs-hub-backup/1') {
    throw new Error(`Formato de backup desconhecido: ${String(backup.formato)}`)
  }
  const refs = backup.documentos.map((d) => db.doc(d.caminho))
  const existentes = new Set<string>()
  for (let i = 0; i < refs.length; i += 300) {
    const lote = refs.slice(i, i + 300)
    if (lote.length === 0) break
    for (const s of await db.getAll(...lote))
      if (s.exists) existentes.add(s.ref.path)
  }
  const resultado: ResultadoRestauro = { gravados: 0, pulados: 0 }
  const writer = db.bulkWriter()
  backup.documentos.forEach((d, i) => {
    if (existentes.has(d.caminho) && !opcoes.sobrescrever) {
      resultado.pulados++
      return
    }
    resultado.gravados++
    if (opcoes.gravar)
      void writer.set(
        refs[i] as DocumentReference,
        deJson(d.dados, db) as Record<string, unknown>,
      )
  })
  await writer.close()
  return resultado
}
