import { describe, expect, it } from 'vitest'
import {
  OPCOES_FIXAS,
  completarFicha,
  linksParaTexto,
  normalizarFicha,
  temConteudo,
  tabelaParaTexto,
  textoParaLinks,
  textoParaTabela,
  urlSegura,
} from './ficha'

describe('tabela em texto', () => {
  it('lê colunas e linhas separadas por |', () => {
    const t = textoParaTabela(
      'SmartShare | DI Client\n3.85.23 | **3.85.19**\n\n3.86.7',
    )
    expect(t.colunas).toEqual(['SmartShare', 'DI Client'])
    expect(t.linhas).toEqual([
      ['3.85.23', '**3.85.19**'],
      ['3.86.7', ''],
    ])
  })
  it('ida e volta mantém o conteúdo', () => {
    const colunas = ['A', 'B']
    const linhas = [['1', '2']]
    expect(textoParaTabela(tabelaParaTexto(colunas, linhas))).toEqual({
      colunas,
      linhas,
    })
  })
  it('descarta células a mais', () => {
    expect(textoParaTabela('A | B\n1 | 2 | 3').linhas).toEqual([['1', '2']])
  })
})

describe('links em texto', () => {
  it('lê rótulo e endereço opcional', () => {
    expect(textoParaLinks('Portal | https://x.com\nSó o rótulo\n')).toEqual([
      { rotulo: 'Portal', url: 'https://x.com' },
      { rotulo: 'Só o rótulo', url: '' },
    ])
    expect(linksParaTexto(textoParaLinks('A | https://a.com\nB'))).toBe(
      'A | https://a.com\nB',
    )
  })
  it('só http, https e mailto viram link', () => {
    expect(urlSegura('https://a.com')).toBe('https://a.com')
    expect(urlSegura('mailto:a@b.com')).toBe('mailto:a@b.com')
    expect(urlSegura('javascript:alert(1)')).toBe('')
  })
})

describe('as 5 opções fixas', () => {
  it('sem nada salvo, devolve as 5 na ordem fixa, com os textos padrão', () => {
    const f = completarFicha(undefined)
    expect(f.secoes.map((s) => s.titulo)).toEqual([
      'Compatibilidade DI',
      'Compatibilidade SmartShare',
      'Instaladores e Aplicativos',
      'Release Notes',
      'Contato',
    ])
    expect(f.secoes.map((s) => s.id)).toEqual(OPCOES_FIXAS.map((o) => o.id))
    expect(f.secoes[0]).toMatchObject({
      tipo: 'tabela',
      colunas: [
        'SmartShare',
        'DI Client',
        'DI Server',
        'WS DI Server',
        'WS DI Client',
      ],
      linhas: [],
    })
    expect(f.secoes[2]?.tipo).toBe('links')
  })

  it('preenche com o que foi salvo, casando pelo id ou pelo título, e ignora o resto', () => {
    const f = completarFicha({
      secoes: [
        {
          id: 'qualquer',
          tipo: 'tabela',
          titulo: 'compatibilidade smartshare',
          texto: 'Texto salvo',
          colunas: ['A', 'B'],
          linhas: [['1', '2']],
        },
        {
          id: 'release-notes',
          tipo: 'links',
          titulo: 'nome mudado',
          texto: '',
          itens: [{ rotulo: 'SmartShare', url: 'https://x.com' }],
        },
        { id: 'extra', tipo: 'texto', titulo: 'Seção inventada', texto: 'x' },
      ],
    })
    expect(f.secoes).toHaveLength(5)
    expect(f.secoes[1]).toMatchObject({
      id: 'compatibilidade-smartshare',
      titulo: 'Compatibilidade SmartShare',
      texto: 'Texto salvo',
      colunas: ['A', 'B'],
      linhas: [['1', '2']],
    })
    expect(f.secoes[3]).toMatchObject({
      itens: [{ rotulo: 'SmartShare', url: 'https://x.com' }],
      texto: '',
    })
    expect(f.secoes.some((s) => s.titulo === 'Seção inventada')).toBe(false)
  })
})

describe('normalizarFicha', () => {
  it('mantém as 5 opções, tira links inseguros e completa linhas curtas', () => {
    const n = normalizarFicha({
      secoes: [
        {
          id: 'compatibilidade-di',
          tipo: 'tabela',
          titulo: 'x',
          texto: '',
          colunas: ['A', 'B'],
          linhas: [['1']],
        },
        {
          id: 'instaladores-e-aplicativos',
          tipo: 'links',
          titulo: 'x',
          texto: '',
          itens: [
            { rotulo: 'ok', url: 'https://x.com' },
            { rotulo: 'ruim', url: 'javascript:alert(1)' },
            { rotulo: '', url: 'https://y.com' },
          ],
        },
      ],
    })
    expect(n.secoes).toHaveLength(5)
    expect(n.secoes[0]).toMatchObject({ linhas: [['1', '']] })
    expect(n.secoes[2]).toMatchObject({
      itens: [
        { rotulo: 'ok', url: 'https://x.com' },
        { rotulo: 'ruim', url: '' },
      ],
    })
  })

  it('limita linhas e itens', () => {
    const linhas = Array.from({ length: 100 }, () => ['1'])
    const n = normalizarFicha({
      secoes: [
        {
          id: 'compatibilidade-di',
          tipo: 'tabela',
          titulo: '',
          texto: '',
          colunas: ['A'],
          linhas,
        },
      ],
    })
    expect((n.secoes[0] as { linhas: string[][] }).linhas).toHaveLength(60)
  })
})

describe('temConteudo', () => {
  const base = { id: 'x', titulo: 'T' }
  it('seção só com título não tem conteúdo; texto, linhas ou links têm', () => {
    expect(temConteudo({ ...base, tipo: 'texto', texto: '' })).toBe(false)
    expect(temConteudo({ ...base, tipo: 'texto', texto: 'Oi' })).toBe(true)
    expect(
      temConteudo({
        ...base,
        tipo: 'tabela',
        texto: '',
        colunas: ['A'],
        linhas: [],
      }),
    ).toBe(false)
    expect(
      temConteudo({
        ...base,
        tipo: 'tabela',
        texto: '',
        colunas: ['A'],
        linhas: [['1']],
      }),
    ).toBe(true)
    expect(temConteudo({ ...base, tipo: 'links', texto: '', itens: [] })).toBe(
      false,
    )
    expect(
      temConteudo({
        ...base,
        tipo: 'links',
        texto: '',
        itens: [{ rotulo: 'a', url: '' }],
      }),
    ).toBe(true)
  })
})
