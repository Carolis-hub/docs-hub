import { describe, expect, it } from 'vitest'
import type { Block } from '../types/content'
import type { SearchItem } from '../types/search'
import { gerarTrecho, normalizar } from './search'
import {
  aplicarItem,
  dividirPorParte,
  parteDoBloco,
  tamanhoBytes,
  truncarTexto,
} from './searchIndex'

describe('normalizar', () => {
  it('remove acentos e coloca em minúsculas', () => {
    expect(normalizar('Configuração Avançada')).toBe('configuracao avancada')
  })
})

describe('gerarTrecho', () => {
  it('destaca o termo ignorando acentos e caixa', () => {
    const partes = gerarTrecho('Veja a Configuração do fluxo de aprovação.', [
      'configuracao',
    ])
    const destacado = partes.filter((p) => p.destaque).map((p) => p.texto)
    expect(destacado).toEqual(['Configuração'])
    expect(partes.map((p) => p.texto).join('')).toBe(
      'Veja a Configuração do fluxo de aprovação.',
    )
  })

  it('recorta ao redor do termo em textos longos', () => {
    const texto = `${'abc '.repeat(100)}alvo final ${'xyz '.repeat(100)}`
    const partes = gerarTrecho(texto, ['alvo'], 60)
    const junto = partes.map((p) => p.texto).join('')
    expect(junto).toContain('alvo')
    expect(junto.startsWith('…')).toBe(true)
    expect(junto.length).toBeLessThan(80)
  })

  it('sem termos devolve o início do texto', () => {
    const partes = gerarTrecho('Texto simples', [])
    expect(partes).toEqual([{ texto: 'Texto simples', destaque: false }])
  })
})

const item = (id: string, blockId = 'b'): SearchItem => ({
  id,
  titulo: id,
  resumo: '',
  textoPlano: '',
  blockId,
  publico: 'usuario',
})

describe('aplicarItem', () => {
  it('substitui pelo mesmo id e remove com null', () => {
    const lista = [item('a'), item('b')]
    expect(
      aplicarItem(lista, 'a', { ...item('a'), titulo: 'novo' }),
    ).toHaveLength(2)
    expect(aplicarItem(lista, 'a', null).map((i) => i.id)).toEqual(['b'])
    expect(aplicarItem(lista, 'c', item('c'))).toHaveLength(3)
  })
})

describe('divisão por subproduto', () => {
  const bloco = (id: string, parentId: string | null): Block => ({
    id,
    nome: id,
    slug: id,
    descricao: '',
    icone: '',
    ordem: 0,
    parentId,
    productId: 'p',
  })
  const arvore = [
    bloco('p', null),
    bloco('bpm', 'p'),
    bloco('fluxos', 'bpm'),
    bloco('ecm', 'p'),
  ]

  it('resolve o subproduto de blocos em qualquer nível', () => {
    expect(parteDoBloco(arvore, 'p')).toBe('raiz')
    expect(parteDoBloco(arvore, 'bpm')).toBe('bpm')
    expect(parteDoBloco(arvore, 'fluxos')).toBe('bpm')
    expect(parteDoBloco(arvore, 'ecm')).toBe('ecm')
  })

  it('agrupa os itens por parte', () => {
    const partes = dividirPorParte(
      [item('1', 'fluxos'), item('2', 'ecm'), item('3', 'p')],
      (b) => parteDoBloco(arvore, b),
    )
    expect(Object.keys(partes).sort()).toEqual(['bpm', 'ecm', 'raiz'])
  })
})

describe('tamanho', () => {
  it('conta bytes em UTF-8 e trunca texto', () => {
    expect(tamanhoBytes({ a: 'é' })).toBeGreaterThan(
      JSON.stringify({ a: 'é' }).length - 1,
    )
    expect(truncarTexto('abcdef', 3)).toBe('abc')
  })
})
