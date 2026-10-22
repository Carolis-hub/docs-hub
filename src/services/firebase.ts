import { getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

if (
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'
) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

/**
 * Segunda instância do Firebase, usada só para criar contas de usuários sem
 * trocar a sessão do admin que está logado na instância principal.
 */
export function getSecondaryAuth() {
  const existing = getApps().find((a) => a.name === 'secondary')
  if (existing) return getAuth(existing)
  const secondary = initializeApp(firebaseConfig, 'secondary')
  const secondaryAuth = getAuth(secondary)
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'
  ) {
    connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    })
  }
  return secondaryAuth
}
