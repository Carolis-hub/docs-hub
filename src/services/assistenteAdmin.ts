import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import type { RegistroAssistente, UsoDiario } from '../types/assistente'
import { db } from './firebase'

/** Contadores diários (global e por usuário) a partir de um dia AAAA-MM-DD. Só admin. */
export async function listarUso(desde: string): Promise<UsoDiario[]> {
  const snap = await getDocs(
    query(collection(db, 'assistenteUso'), where('dia', '>=', desde)),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UsoDiario)
}

/** Últimas perguntas feitas ao assistente, da mais nova para a mais antiga. Só admin. */
export async function listarRegistros(
  maximo = 300,
): Promise<RegistroAssistente[]> {
  const snap = await getDocs(
    query(
      collection(db, 'assistenteLog'),
      orderBy('criadoEm', 'desc'),
      limit(maximo),
    ),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegistroAssistente)
}
