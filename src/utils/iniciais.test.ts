import { describe, expect, it } from 'vitest'
import { iniciais } from './iniciais'

describe('iniciais', () => {
  it.each([
    ['Ana Maria Souza', 'a@b.com', 'AS'],
    ['Carolina', 'c@b.com', 'CA'],
    ['  joão   da silva ', undefined, 'JS'],
    [undefined, 'maria.silva@x.com', 'MS'],
    [undefined, undefined, '?'],
  ])('%j / %j → %s', (nome, email, esperado) => {
    expect(iniciais(nome, email)).toBe(esperado)
  })
})
