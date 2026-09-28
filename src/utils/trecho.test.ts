import { describe, expect, it } from 'vitest'
import { gerarTrecho } from './trecho'

const texto =
  'Este artigo explica como configurar um fluxo de aprovação no BPM, ' +
  'passo a passo, incluindo a definição de aprovadores e prazos.'

describe('gerarTrecho', () => {
  it('encontra o termo ignorando acentos e maiúsculas', () => {
    const trecho = gerarTrecho(texto, ['APROVAÇÃO'])
    expect(trecho).not.toBeNull()
    expect(trecho?.destaque.toLowerCase()).toBe('aprovação')
  })

  it('retorna o início do texto quando nenhum termo é encontrado', () => {
    const trecho = gerarTrecho(texto, ['inexistente'])
    expect(trecho?.destaque).toBe('')
    expect(trecho?.depois.length).toBeGreaterThan(0)
  })

  it('usa o termo que aparece primeiro no texto', () => {
    const trecho = gerarTrecho(texto, ['prazos', 'artigo'])
    expect(trecho?.destaque.toLowerCase()).toBe('artigo')
  })
})
