import { collection, getDocs } from 'firebase/firestore'
import type { Sincronizacao } from '../types/sincronizacao'
import { db } from './firebase'

/** Resumo da última rodada de cada fonte de documentos (só admin). Uma leitura por fonte. */
export async function listarSincronizacoes(): Promise<Sincronizacao[]> {
  const snap = await getDocs(collection(db, 'sincronizacoes'))
  return snap.docs.map((d) => ({
    ...(d.data() as Omit<Sincronizacao, 'fonteId'>),
    fonteId: d.id,
  }))
}
