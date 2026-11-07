/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    // O Firebase sozinho tem ~630 kB e não dá para reduzir; o aviso passa a valer
    // para qualquer outro arquivo que crescer além disso (veja docs/desempenho.md).
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      output: {
        // Firebase e React em arquivos próprios e com nome estável: o navegador
        // guarda cada um e só baixa de novo o que mudar numa nova versão. O editor
        // (TipTap) fica de fora de propósito: ele só é baixado ao abrir um artigo.
        codeSplitting: {
          groups: [
            {
              name: 'firebase',
              test: /node_modules[\\/](@firebase|firebase)[\\/]/,
              priority: 30,
            },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|@remix-run)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', 'tests/**'],
  },
})
