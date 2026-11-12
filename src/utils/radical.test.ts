import { describe, expect, it } from 'vitest'
import type { IndexedItem } from '../types/search'
import { formasDoRadical, gerarTrecho, radical } from './search'
import { criarMotor } from './searchEngine'

describe('radical (plural em português)', () => {
  it.each([
    ['relatorios', 'relatorio'],
    ['usuarios', 'usuario'],
    ['permissoes', 'permissao'],
    ['manuais', 'manual'],
    ['niveis', 'nivel'],
    ['itens', 'item'],
    ['imagens', 'imagem'],
    ['detalhes', 'detalhe'],
  ])('%s → %s', (plural, singular) => {
    expect(radical(plural)).toBe(singular)
    expect(radical(singular)).toBe(singular)
  })

  it('palavras curtas e exceções não caem nas regras de plural irregular', () => {
    // "mais" não pode virar "mal" (regra de "-ais"); perder o "s" é inofensivo.
    expect(radical('mais')).toBe('mai')
    expect(radical('leis')).toBe('lei')
    expect(radical('seis')).toBe('sei')
    expect(radical('depois')).toBe('depois')
    expect(radical('os')).toBe('os')
    expect(radical('api')).toBe('api')
  })
})

describe('busca com plural e singular', () => {
  const item = (id: string, titulo: string, texto: string): IndexedItem => ({
    id,
    titulo,
    resumo: '',
    textoPlano: texto,
    blockId: 'b',
    publico: 'usuario',
    productId: 'p',
  })
  const motor = criarMotor(
    [
      item('a1', 'Relatório mensal', 'Como emitir o relatório.'),
      item('a2', 'Permissões de acesso', 'As permissões são por perfil.'),
      item('a3', 'Itens do pedido', 'Cada item tem um valor.'),
    ],
    true,
  )

  it('plural acha singular e singular acha plural', () => {
    expect(motor.buscar('relatórios').map((r) => r.item.id)).toEqual(['a1'])
    expect(motor.buscar('permissão').map((r) => r.item.id)).toEqual(['a2'])
    expect(motor.buscar('item').map((r) => r.item.id)).toEqual(['a3'])
    expect(motor.buscar('itens').map((r) => r.item.id)).toEqual(['a3'])
  })

  it('o destaque cobre o plural escrito no texto', () => {
    const [achado] = motor.buscar('permissão')
    const partes = gerarTrecho('As permissões são por perfil.', achado!.termos)
    expect(partes.find((p) => p.destaque)?.texto).toBe('permissões')
  })

  it('formasDoRadical devolve o radical e os plurais possíveis', () => {
    expect(formasDoRadical('permissao')).toEqual([
      'permissao',
      'permissoes',
      'permissaes',
    ])
    expect(formasDoRadical('item')).toEqual(['item', 'itens'])
    expect(formasDoRadical('fluxo')).toEqual(['fluxo'])
  })
})
