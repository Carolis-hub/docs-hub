/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_CLOUDINARY_CLOUD_NAME: string
  readonly VITE_CLOUDINARY_UPLOAD_PRESET: string
  readonly VITE_USE_FIREBASE_EMULATOR?: string
  /** Endereço do servidor do assistente de IA; sem ele a tela do assistente avisa que falta configurar. */
  readonly VITE_ASSISTENTE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
