import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Evita inicializar o Firebase de verdade nos testes: qualquer teste que
// precise de comportamento real deve mockar explicitamente os serviços
// que usam este módulo (services/blocks.ts, services/articles.ts etc.).
vi.mock('../services/firebase', () => ({
  app: {},
  auth: {},
  db: {},
}))

afterEach(() => {
  cleanup()
})
