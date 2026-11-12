import { describe, expect, it } from 'vitest'
import { produtoDaConsulta } from './produtoDaConsulta'

const produtos = [{ id: 'p1' }, { id: 'p2' }]

describe('produtoDaConsulta', () => {
  it('o pedido (URL) vale mais que o contexto', () => {
    expect(produtoDaConsulta('p2', 'p1', produtos)).toBe('p2')
  })

  it('sem pedido, herda o produto em contexto', () => {
    expect(produtoDaConsulta(undefined, 'p1', produtos)).toBe('p1')
  })

  it('sem pedido nem contexto, quem tem vários produtos precisa escolher', () => {
    expect(produtoDaConsulta(undefined, '', produtos)).toBe('')
  })

  it('quem só tem um produto já consulta nele', () => {
    expect(produtoDaConsulta(undefined, '', [{ id: 'p1' }])).toBe('p1')
  })

  it('nunca devolve produto que a pessoa não pode ver', () => {
    expect(produtoDaConsulta('secreto', 'p1', produtos)).toBe('')
    expect(produtoDaConsulta(undefined, 'antigo', produtos)).toBe('')
    expect(produtoDaConsulta(undefined, 'antigo', [{ id: 'p1' }])).toBe('p1')
  })

  it('sem produtos, não há onde consultar', () => {
    expect(produtoDaConsulta('p1', 'p1', [])).toBe('')
  })
})
