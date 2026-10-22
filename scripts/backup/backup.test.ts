// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cifrar, decifrar } from './cripto.ts'

describe('cifragem do backup', () => {
  const dados = Buffer.from(JSON.stringify({ a: 'ação', n: [1, 2, 3] }))

  it('cifra e decifra com a mesma senha', () => {
    const arq = cifrar(dados, 'segredo')
    expect(arq.includes(Buffer.from('ação'))).toBe(false)
    expect(decifrar(arq, 'segredo').equals(dados)).toBe(true)
  })

  it('cada cifragem é diferente (sal e iv aleatórios)', () => {
    expect(cifrar(dados, 's').equals(cifrar(dados, 's'))).toBe(false)
  })

  it('rejeita senha errada, arquivo adulterado e arquivo alheio', () => {
    const arq = cifrar(dados, 'segredo')
    expect(() => decifrar(arq, 'outra')).toThrow(/Senha incorreta/)
    const adulterado = Buffer.from(arq)
    adulterado[adulterado.length - 1] =
      (adulterado[adulterado.length - 1] ?? 0) ^ 1
    expect(() => decifrar(adulterado, 'segredo')).toThrow(/corrompido/)
    expect(() => decifrar(Buffer.from('nada'), 'segredo')).toThrow(
      /não é um backup/,
    )
  })

  it('exige senha', () => {
    expect(() => cifrar(dados, '')).toThrow(/senha/i)
  })
})
