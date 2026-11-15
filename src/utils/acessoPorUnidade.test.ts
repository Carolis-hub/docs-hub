import { describe, expect, it } from 'vitest'
import {
  SEM_UNIDADE,
  mesmosIds,
  produtosDasUnidades,
  unidadesIniciais,
} from './acessoPorUnidade'

const produtos = [
  { id: 'ss4', unidadeId: 'ps' },
  { id: 'di', unidadeId: 'ps' },
  { id: 'erp', unidadeId: 'fin' },
  { id: 'solto' },
  { id: 'orfao', unidadeId: 'apagada' },
]
const unidades = ['ps', 'fin']

describe('produtosDasUnidades', () => {
  it('devolve os produtos das BUs liberadas', () => {
    expect(produtosDasUnidades(['ps'], produtos, unidades)).toEqual([
      'di',
      'ss4',
    ])
    expect(produtosDasUnidades([], produtos, unidades)).toEqual([])
  })

  it('produto sem BU (ou de BU que não existe mais) só entra com "sem BU"', () => {
    expect(produtosDasUnidades(['fin'], produtos, unidades)).toEqual(['erp'])
    expect(produtosDasUnidades([SEM_UNIDADE], produtos, unidades)).toEqual([
      'orfao',
      'solto',
    ])
  })
})

describe('unidadesIniciais', () => {
  it('usa o que já foi gravado', () => {
    expect(
      unidadesIniciais(
        { unidadesPermitidas: ['fin'], produtosPermitidos: ['ss4'] },
        produtos,
        unidades,
      ),
    ).toEqual(['fin'])
  })

  it('conta antiga: só marca a BU em que ela vê todos os produtos', () => {
    expect(
      unidadesIniciais(
        { produtosPermitidos: ['ss4', 'erp'] },
        produtos,
        unidades,
      ),
    ).toEqual(['fin'])
    expect(
      unidadesIniciais(
        { produtosPermitidos: ['ss4', 'di', 'solto', 'orfao'] },
        produtos,
        unidades,
      ),
    ).toEqual(['ps', SEM_UNIDADE])
  })

  it('usuário novo começa sem nenhuma BU', () => {
    expect(unidadesIniciais(undefined, produtos, unidades)).toEqual([])
  })
})

describe('mesmosIds', () => {
  it('ignora a ordem', () => {
    expect(mesmosIds(['a', 'b'], ['b', 'a'])).toBe(true)
    expect(mesmosIds(['a'], ['a', 'b'])).toBe(false)
    expect(mesmosIds(undefined, [])).toBe(true)
  })
})
