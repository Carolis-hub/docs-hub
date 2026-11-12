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

describe('busca que não deixa a frase sem resposta', () => {
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
      item(
        'lote',
        'Como baixar anexos em lote',
        'Selecione os anexos e baixe.',
      ),
      item(
        'versoes',
        'Histórico de versões do anexo',
        'Cada versão fica guardada.',
      ),
      item(
        'idioma',
        'Como alterar o idioma',
        'Escolha o idioma nas preferências.',
      ),
    ],
    true,
  )

  it('com todas as palavras, nada muda e o resultado não é aproximado', () => {
    const [achado] = motor.buscar('baixar anexos')
    expect(achado?.item.id).toBe('lote')
    expect(achado?.parcial).toBeUndefined()
  })

  it('palavras comuns ("de", "uma") deixam de zerar a busca', () => {
    const achados = motor.buscar('idioma de uma')
    expect(achados.map((r) => r.item.id)).toEqual(['idioma'])
    expect(achados[0]?.parcial).toBeUndefined()
  })

  it('frase com palavra que o artigo não tem acha pela maior parte das palavras', () => {
    const achados = motor.buscar('baixar vários anexos de uma vez')
    expect(achados[0]?.item.id).toBe('lote')
    expect(achados.every((r) => r.parcial)).toBe(true)
    expect(
      motor.buscar('versões anteriores do anexo').map((r) => r.item.id),
    ).toContain('versoes')
  })

  it('exige pelo menos metade das palavras: uma só em quatro não basta', () => {
    expect(motor.buscar('idioma boleto fatura cobrança')).toEqual([])
  })

  it('uma palavra só, que não existe, continua sem resultado', () => {
    expect(motor.buscar('boleto')).toEqual([])
  })

  it('quem pede AND ou OR explicitamente não ganha a segunda tentativa', () => {
    expect(
      motor.buscar('baixar vários anexos de uma vez', { combinar: 'AND' }),
    ).toEqual([])
  })
})
