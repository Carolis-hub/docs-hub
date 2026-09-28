import { describe, expect, it } from 'vitest'
import { formatarDataChave, mesesDesde } from './data'

describe('formatarDataChave', () => {
  it('formata como AAAA-MM-DD com zero à esquerda', () => {
    expect(formatarDataChave(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('mesesDesde', () => {
  it('calcula quantos meses se passaram', () => {
    const seisMesesEmMs = 1000 * 60 * 60 * 24 * 30.44 * 6
    const agora = Date.now()
    expect(mesesDesde(agora - seisMesesEmMs, agora)).toBeCloseTo(6, 1)
  })
})
