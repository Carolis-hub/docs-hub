import { beforeEach, describe, expect, it } from 'vitest'
import {
  chaveIAValida,
  gravarChaveIA,
  lerChaveIA,
  mascararChave,
} from './chaveIA'

beforeEach(() => localStorage.clear())

describe('chaveIA', () => {
  it('valida o formato', () => {
    expect(chaveIAValida('sk-ant-' + 'a'.repeat(30))).toBe(true)
    expect(chaveIAValida('curta')).toBe(false)
    expect(chaveIAValida('com espaço ' + 'a'.repeat(30))).toBe(false)
  })
  it('mascara a chave', () => {
    expect(mascararChave('sk-ant-abcdefghijklmnop1234')).toBe('sk-ant-…1234')
    expect(mascararChave('curta')).toBe('••••')
  })
  it('guarda por usuário e remove com texto vazio', () => {
    gravarChaveIA('u1', ' sk-ant-' + 'a'.repeat(30) + ' ')
    expect(lerChaveIA('u1')).toBe('sk-ant-' + 'a'.repeat(30))
    expect(lerChaveIA('u2')).toBe('')
    gravarChaveIA('u1', '')
    expect(lerChaveIA('u1')).toBe('')
  })
})
