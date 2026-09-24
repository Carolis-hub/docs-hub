import { describe, expect, it } from 'vitest'
import { montarOpcoesDeBloco } from './blockTree'
import type { Block } from '../types/block'

function bloco(parcial: Partial<Block> & Pick<Block, 'id' | 'nome'>): Block {
  return {
    slug: parcial.nome.toLowerCase(),
    descricao: '',
    icone: '',
    ordem: 0,
    parentId: null,
    productId: parcial.id,
    ...parcial,
  }
}

describe('montarOpcoesDeBloco', () => {
  it('monta o caminho completo até a raiz', () => {
    const blocos = [
      bloco({ id: 'smartshare', nome: 'Smartshare' }),
      bloco({ id: 'bpm', nome: 'BPM', parentId: 'smartshare' }),
      bloco({ id: 'ecm', nome: 'ECM', parentId: 'smartshare' }),
    ]

    const opcoes = montarOpcoesDeBloco(blocos)

    expect(opcoes).toEqual([
      { id: 'smartshare', caminho: 'Smartshare' },
      { id: 'bpm', caminho: 'Smartshare > BPM' },
      { id: 'ecm', caminho: 'Smartshare > ECM' },
    ])
  })
})
