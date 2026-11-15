import { describe, expect, it } from 'vitest'
import { lerMarkdown, trechosMd, urlPermitida } from './markdownRodape'

describe('trechosMd', () => {
  it('lê negrito, itálico, código e link', () => {
    expect(trechosMd('**a** *b* `c` [d](https://x.com)')).toEqual([
      { tipo: 'negrito', trechos: [{ tipo: 'texto', texto: 'a' }] },
      { tipo: 'texto', texto: ' ' },
      { tipo: 'italico', trechos: [{ tipo: 'texto', texto: 'b' }] },
      { tipo: 'texto', texto: ' ' },
      { tipo: 'codigo', texto: 'c' },
      { tipo: 'texto', texto: ' ' },
      {
        tipo: 'link',
        url: 'https://x.com',
        trechos: [{ tipo: 'texto', texto: 'd' }],
      },
    ])
  })

  it('caracteres de escape mostram o símbolo, sem formatar', () => {
    expect(trechosMd('\\*não\\* \\[x\\](y) 1\\. a\\\\b')).toEqual([
      { tipo: 'texto', texto: '*não* [x](y) 1. a\\b' },
    ])
  })

  it('um asterisco escapado não fecha o negrito', () => {
    expect(trechosMd('**a\\**b**')).toEqual([
      { tipo: 'negrito', trechos: [{ tipo: 'texto', texto: 'a**b' }] },
    ])
  })

  it('link com endereço perigoso vira só texto', () => {
    const t = trechosMd('[clique](javascript:alert)')
    expect(t).toEqual([{ tipo: 'texto', texto: 'clique' }])
    expect(urlPermitida('//evil.com')).toBe('')
    expect(urlPermitida('/b/abc')).toBe('/b/abc')
  })

  it('marcação sem fechamento fica como texto', () => {
    expect(trechosMd('**aberto e [sem fim')).toEqual([
      { tipo: 'texto', texto: '**aberto e [sem fim' },
    ])
  })
})

describe('lerMarkdown', () => {
  it('separa parágrafos, títulos e listas', () => {
    const b = lerMarkdown('# T\n\nlinha 1\nlinha 2\n\n- a\n- b\n\n1. x')
    expect(b.map((x) => x.tipo)).toEqual([
      'titulo',
      'paragrafo',
      'lista',
      'lista',
    ])
    expect(b[2]).toMatchObject({ ordenada: false })
    expect(b[3]).toMatchObject({ ordenada: true })
    expect(b[1]).toMatchObject({
      trechos: [{ tipo: 'texto', texto: 'linha 1 linha 2' }],
    })
  })

  it('HTML não é interpretado: continua sendo texto', () => {
    expect(lerMarkdown('<script>x</script>')).toEqual([
      {
        tipo: 'paragrafo',
        trechos: [{ tipo: 'texto', texto: '<script>x</script>' }],
      },
    ])
  })
})

describe('tabelas', () => {
  it('lê cabeçalho, linhas e formatação dentro das células', () => {
    const [t] = lerMarkdown(
      '| Sistema | Versão |\n| --- | :---: |\n| **Windows** | 11 |\n| Linux | a \\| b |',
    )
    expect(t).toMatchObject({
      tipo: 'tabela',
      cabecalho: [
        [{ tipo: 'texto', texto: 'Sistema' }],
        [{ tipo: 'texto', texto: 'Versão' }],
      ],
    })
    if (t?.tipo !== 'tabela') throw new Error('não é tabela')
    expect(t.linhas).toHaveLength(2)
    expect(t.linhas[0]?.[0]?.[0]).toMatchObject({ tipo: 'negrito' })
    expect(t.linhas[1]?.[1]).toEqual([{ tipo: 'texto', texto: 'a | b' }])
  })

  it('sem a linha de traços não há cabeçalho; linhas curtas são completadas', () => {
    const [t] = lerMarkdown('| a | b | c |\n| d |')
    if (t?.tipo !== 'tabela') throw new Error('não é tabela')
    expect(t.cabecalho).toEqual([])
    expect(t.linhas.map((l) => l.length)).toEqual([3, 3])
  })

  it('convive com parágrafos e listas em volta', () => {
    expect(
      lerMarkdown('Antes\n| a | b |\n| - | - |\n| 1 | 2 |\nDepois\n- item').map(
        (b) => b.tipo,
      ),
    ).toEqual(['paragrafo', 'tabela', 'paragrafo', 'lista'])
  })
})
