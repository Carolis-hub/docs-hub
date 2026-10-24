import { describe, expect, it } from 'vitest'
import {
  altFraco,
  aplicarAlts,
  imagensComContexto,
  normalizarAlt,
} from './altTexto'

const p = (t: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text: t }],
})
const h = (t: string) => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [{ type: 'text', text: t }],
})
const img = (src: string, alt = '') => ({ type: 'image', attrs: { src, alt } })

const doc = {
  type: 'doc',
  content: [
    p('Introdução ao anexo.'),
    h('Adicionar anexos'),
    p('Clique no ícone de anexos.'),
    img('https://cdn/a.gif', 'Imagem 1 do artigo "X"'),
    img('https://cdn/b.png', 'Tela de erro'),
    p('Depois, arraste os arquivos.'),
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [p('Item da lista'), img('https://cdn/c.png')],
        },
      ],
    },
  ],
}

describe('imagensComContexto', () => {
  const r = imagensComContexto(doc)

  it('lista as imagens em ordem de leitura, inclusive dentro de listas', () => {
    expect(r.map((i) => i.src)).toEqual([
      'https://cdn/a.gif',
      'https://cdn/b.png',
      'https://cdn/c.png',
    ])
    expect(r.map((i) => i.indice)).toEqual([0, 1, 2])
  })

  it('traz a seção e o texto antes e depois', () => {
    expect(r[0]).toMatchObject({
      secao: 'Adicionar anexos',
      antes: 'Clique no ícone de anexos.',
      depois: 'Depois, arraste os arquivos.',
    })
  })

  it('imagens seguidas dividem o mesmo contexto', () => {
    expect(r[1]).toMatchObject({
      antes: 'Clique no ícone de anexos.',
      depois: 'Depois, arraste os arquivos.',
    })
  })

  it('a última imagem fica sem texto depois', () => {
    expect(r[2]).toMatchObject({ antes: 'Item da lista', depois: '' })
  })

  it('corta contextos longos', () => {
    const longo = imagensComContexto({
      type: 'doc',
      content: [p('x'.repeat(500)), img('u')],
    })
    expect(longo[0]?.antes).toHaveLength(301)
  })
})

describe('aplicarAlts', () => {
  it('troca só o alt pedido e não altera o original', () => {
    const novo = aplicarAlts(
      doc,
      new Map([
        [0, 'Ícone de anexos na barra lateral'],
        [2, 'Lista de arquivos'],
      ]),
    )
    expect(imagensComContexto(novo).map((i) => i.alt)).toEqual([
      'Ícone de anexos na barra lateral',
      'Tela de erro',
      'Lista de arquivos',
    ])
    expect(imagensComContexto(doc)[0]?.alt).toBe('Imagem 1 do artigo "X"')
  })
})

describe('altFraco', () => {
  it.each([
    ['', true],
    ['   ', true],
    ['Imagem 3 do artigo "Como anexar"', true],
    ['Tela de login com os campos usuário e senha', false],
  ])('%j', (alt, esperado) => {
    expect(altFraco(alt)).toBe(esperado)
  })
})

describe('normalizarAlt', () => {
  it.each([
    ['  Tela de login   com dois campos ', 'Tela de login com dois campos'],
    ['"Botão Salvar no canto inferior"', 'Botão Salvar no canto inferior'],
    ['Imagem de tela com o painel de tarefas', 'Tela com o painel de tarefas'],
    ['Captura de tela do painel', 'Tela do painel'],
    ['Print: lista de documentos', 'Lista de documentos'],
    ['botão adicionar anexos', 'Botão adicionar anexos'],
  ])('%j', (entrada, saida) => {
    expect(normalizarAlt(entrada)).toBe(saida)
  })

  it('devolve null quando não sobra nada e corta textos enormes', () => {
    expect(normalizarAlt('   ')).toBeNull()
    expect(normalizarAlt('Imagem')).toBeNull()
    const longo = normalizarAlt('palavra '.repeat(100))
    expect(longo?.length).toBeLessThanOrEqual(200)
    expect(longo?.endsWith('…')).toBe(true)
  })
})
