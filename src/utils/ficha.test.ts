import { describe, expect, it } from 'vitest'
import type { Ficha } from '../types/content'
import {
  fichaModelo,
  linksParaTexto,
  moverSecao,
  normalizarFicha,
  secaoVazia,
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

describe('normalizarFicha', () => {
  it('descarta seções vazias e links inseguros e completa linhas curtas', () => {
    const f: Ficha = {
      secoes: [
        { id: 'a', tipo: 'texto', titulo: '  ', texto: '' },
        {
          id: 'b',
          tipo: 'links',
          titulo: 'Portal',
          texto: '',
          itens: [
            { rotulo: 'ok', url: 'https://x.com' },
            { rotulo: 'ruim', url: 'javascript:alert(1)' },
            { rotulo: '', url: 'https://y.com' },
          ],
        },
        {
          id: 'c',
          tipo: 'tabela',
          titulo: 'T',
          texto: '',
          colunas: ['A', 'B'],
          linhas: [['1']],
        },
      ],
    }
    const n = normalizarFicha(f)
    expect(n.secoes.map((s) => s.id)).toEqual(['b', 'c'])
    expect(n.secoes[0]).toMatchObject({
      itens: [
        { rotulo: 'ok', url: 'https://x.com' },
        { rotulo: 'ruim', url: '' },
      ],
    })
    expect(n.secoes[1]).toMatchObject({ linhas: [['1', '']] })
  })
  it('limita o número de seções', () => {
    const secoes = Array.from({ length: 30 }, (_, i) => ({
      id: `s${i}`,
      tipo: 'texto' as const,
      titulo: `T${i}`,
      texto: '',
    }))
    expect(normalizarFicha({ secoes }).secoes).toHaveLength(20)
  })
})

describe('moverSecao e modelo', () => {
  it('troca a ordem e respeita as pontas', () => {
    const f: Ficha = {
      secoes: [secaoVazia('texto'), secaoVazia('links')],
    }
    const [a, b] = f.secoes
    expect(moverSecao(f, (a as { id: string }).id, 1).secoes[1]?.id).toBe(
      (a as { id: string }).id,
    )
    expect(moverSecao(f, (a as { id: string }).id, -1)).toBe(f)
    expect(moverSecao(f, (b as { id: string }).id, 1)).toBe(f)
  })
  it('o modelo traz as cinco seções e passa pela limpeza', () => {
    const m = fichaModelo()
    expect(m.secoes.map((s) => s.titulo)).toEqual([
      'Compatibilidade DI',
      'Compatibilidade SmartShare',
      'Instaladores e Aplicativos',
      'Release Notes',
      'Contato',
    ])
    expect(normalizarFicha(m).secoes).toHaveLength(5)
  })
})
