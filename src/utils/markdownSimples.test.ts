import { describe, expect, it } from 'vitest'
import { lerResposta, trechosDaLinha } from './markdownSimples'

describe('trechosDaLinha', () => {
  it('separa texto, negrito, código e citações', () => {
    expect(
      trechosDaLinha('Abra **Configurações** e rode `ping` [1][2].'),
    ).toEqual([
      { tipo: 'texto', texto: 'Abra ' },
      { tipo: 'negrito', texto: 'Configurações' },
      { tipo: 'texto', texto: ' e rode ' },
      { tipo: 'codigo', texto: 'ping' },
      { tipo: 'texto', texto: ' ' },
      { tipo: 'citacao', numero: 1 },
      { tipo: 'citacao', numero: 2 },
      { tipo: 'texto', texto: '.' },
    ])
  })

  it('não interpreta HTML: continua sendo texto', () => {
    expect(trechosDaLinha('<img src=x onerror=alert(1)>')).toEqual([
      { tipo: 'texto', texto: '<img src=x onerror=alert(1)>' },
    ])
  })
})

describe('lerResposta', () => {
  it('junta linhas seguidas num parágrafo e separa por linha em branco', () => {
    const b = lerResposta('Primeira linha\ncontinua.\n\nSegundo parágrafo.')
    expect(b).toHaveLength(2)
    expect(b[0]).toMatchObject({ tipo: 'paragrafo' })
  })

  it('reconhece listas com marcadores e numeradas', () => {
    const b = lerResposta(
      'Passos:\n1. Abra o menu\n2. Clique em **Salvar** [1]\n\n- item a\n- item b',
    )
    expect(b.map((x) => x.tipo)).toEqual(['paragrafo', 'lista', 'lista'])
    expect(b[1]).toMatchObject({ ordenada: true })
    expect((b[1] as { itens: unknown[] }).itens).toHaveLength(2)
    expect(b[2]).toMatchObject({ ordenada: false })
  })

  it('trocar de tipo de lista fecha a anterior', () => {
    const b = lerResposta('1. um\n- dois')
    expect(b.map((x) => (x.tipo === 'lista' ? x.ordenada : null))).toEqual([
      true,
      false,
    ])
  })

  it('texto vazio não gera blocos', () => {
    expect(lerResposta('  \n\n')).toEqual([])
  })
})
