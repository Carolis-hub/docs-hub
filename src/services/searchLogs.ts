import { doc, increment, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { slugify } from '../utils/slug'

export async function registrarBuscaSemResultado(termo: string): Promise<void> {
  const termoNormalizado = termo.trim().toLowerCase()
  if (!termoNormalizado) return

  const id = slugify(termoNormalizado) || 'termo'

  try {
    await setDoc(
      doc(db, 'buscasSemResultado', id),
      {
        termo: termoNormalizado,
        contagem: increment(1),
        ultimaBusca: serverTimestamp(),
      },
      { merge: true },
    )
  } catch {
    // Registro é só informativo; uma falha aqui não deve atrapalhar a busca.
  }
}
