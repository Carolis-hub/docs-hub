import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
} from 'firebase/firestore'

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const usandoEmulator =
  import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Cache persistente (IndexedDB): evita reler do servidor, entre sessões,
// dados já vistos, como os índices de busca (searchIndex/{productId}).
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
})

if (usandoEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
