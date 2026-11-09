import { doc, getDoc, setDoc } from 'firebase/firestore'
import type { PreferenciasUsuario } from '../types/preferencias'
import { normalizarPreferencias } from '../utils/preferencias'
import { db } from './firebase'

const ref = (uid: string) => doc(db, 'preferenciasUsuario', uid)

/** `null` quando a pessoa ainda não salvou nenhuma configuração. */
export async function lerPreferencias(
  uid: string,
): Promise<PreferenciasUsuario | null> {
  const snap = await getDoc(ref(uid))
  return snap.exists() ? normalizarPreferencias(snap.data()) : null
}

export async function salvarPreferencias(
  uid: string,
  preferencias: PreferenciasUsuario,
): Promise<void> {
  await setDoc(ref(uid), { ...preferencias, atualizadoEm: Date.now() })
}
