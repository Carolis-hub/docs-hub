import { describe, expect, it } from 'vitest'
import { variantesComSinonimos } from './consulta'
import { criarMotor } from './searchEngine'
import {
  MAX_GRUPOS_SINONIMOS,
  gruposDeSinonimos,
  limparSinonimos,
} from './sinonimos'
import type { IndexedItem } from '../types/search'

describe('limparSinonimos', () => {
  it('apara, tira repetidos e descarta linha com um termo só', () => {
    expect(
      limparSinonimos([
        '  excluir ,apagar;  remover , apagar ',
        'sozinho',
        '',
        ' , ',
      ]),
    ).toEqual(['excluir, apagar, remover'])
  })

  it('respeita o limite de grupos', () => {
    const muitas = Array.from({ length: 500 }, (_, i) => `a${i}, b${i}`)
    expect(limparSinonimos(muitas)).toHaveLength(MAX_GRUPOS_SINONIMOS)
  })
})

describe('gruposDeSinonimos', () => {
  it('normaliza para a busca (minúsculas, sem acento)', () => {
    expect(gruposDeSinonimos(['Exclusão, Remoção'])).toEqual([
      ['exclusao', 'remocao'],
    ])
    expect(gruposDeSinonimos(undefined)).toEqual([])
  })
})

describe('variantesComSinonimos com glossário do produto', () => {
  it('troca o termo pelos sinônimos do grupo informado', () => {
    expect(
      variantesComSinonimos('como apagar documento', 6, [
        ['excluir', 'apagar', 'remover'],
      ]),
    ).toEqual(['excluir documento', 'remover documento'])
  })

  it('termo com caractere especial não quebra nem vira expressão regular', () => {
    expect(variantesComSinonimos('erro c++', 6, [['c++', 'cpp']])).toEqual([
      'erro cpp',
    ])
    expect(
      variantesComSinonimos('custo', 6, [['custo', 'valor em $1']]),
    ).toEqual(['valor em $1'])
    expect(variantesComSinonimos('abc', 6, [['a.c', 'x']])).toEqual([])
  })
})

describe('motor de busca com sinônimos do produto', () => {
  const item = (id: string, titulo: string, texto: string): IndexedItem => ({
    id,
    titulo,
    resumo: '',
    textoPlano: texto,
    blockId: 'b',
    publico: 'usuario',
    productId: 'p',
  })
  const itens = [
    item('a1', 'Excluir documento', 'Passos para excluir um documento.'),
    item('a2', 'Apagar rascunho', 'Como apagar um rascunho de documento.'),
  ]

  it('sem glossário, só acha a palavra digitada', () => {
    const motor = criarMotor(itens, true)
    expect(motor.buscar('apagar documento').map((r) => r.item.id)).toEqual([
      'a2',
    ])
  })

  it('com glossário, acha também pelo sinônimo, abaixo do termo exato', () => {
    const motor = criarMotor(itens, true, {
      sinonimos: [['excluir', 'apagar']],
    })
    expect(motor.buscar('apagar documento').map((r) => r.item.id)).toEqual([
      'a2',
      'a1',
    ])
    // O termo que casou pelo sinônimo entra no destaque.
    const a1 = motor.buscar('apagar documento').find((r) => r.item.id === 'a1')
    expect(a1?.termos).toContain('excluir')
  })
})
