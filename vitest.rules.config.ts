import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Os testes compartilham o mesmo Emulator, então rodam um arquivo por vez.
    fileParallelism: false,
  },
})
