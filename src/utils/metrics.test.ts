import { describe, expect, it } from 'vitest'
import type { Article } from '../types/content'
import {
  chaveVisualizacao,
  diaLocal,
  maisAcessados,
  semAcesso,
  semRevisao,
  serieDiaria,
  ultimosDias,
  viewsPorArtigo,
} from './metrics'

const artigo = (id: string, extra: Partial<Article> = {}): Article =>
  ({
    id,
    titulo: id,
    status: 'published',
    views: 0,
    revisadoEm: Date.now(),
    ...extra,
  }) as Article

describe('datas', () => {
  it('formata o dia no fuso local', () => {
    expect(diaLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('lista os últimos dias em ordem, incluindo hoje', () => {
    expect(ultimosDias(3, new Date(2026, 2, 1))).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ])
  })

  it('gera chave única por leitor, artigo e dia', () => {
    expect(chaveVisualizacao('u', 'a', '2026-01-01')).toBe(
      'docshub:view:u:a:2026-01-01',
    )
  })
})

describe('agregações', () => {
  const registros = [
    { articleId: 'a', dia: '2026-03-01', count: 2 },
    { articleId: 'b', dia: '2026-03-01', count: 3 },
    { articleId: 'a', dia: '2026-03-02', count: 1 },
  ]

  it('soma por dia, preenchendo dias sem acesso com zero', () => {
    expect(
      serieDiaria(['2026-02-28', '2026-03-01', '2026-03-02'], registros),
    ).toEqual([
      { dia: '2026-02-28', count: 0 },
      { dia: '2026-03-01', count: 5 },
      { dia: '2026-03-02', count: 1 },
    ])
  })

  it('soma por artigo', () => {
    expect([...viewsPorArtigo(registros)]).toEqual([
      ['a', 3],
      ['b', 3],
    ])
  })

  it('ranking ignora rascunhos e artigos sem acesso no período', () => {
    const artigos = [
      artigo('a', { views: 10 }),
      artigo('b', { views: 50 }),
      artigo('c', { status: 'draft' }),
      artigo('d'),
    ]
    const periodo = new Map([
      ['a', 3],
      ['b', 3],
      ['c', 9],
    ])
    expect(maisAcessados(artigos, periodo).map((r) => r.artigo.id)).toEqual([
      'b',
      'a',
    ])
  })
})

describe('semAcesso e semRevisao', () => {
  it('lista publicados com zero acessos', () => {
    const lista = semAcesso([
      artigo('a', { views: 1 }),
      artigo('b'),
      artigo('c', { status: 'draft' }),
    ])
    expect(lista.map((a) => a.id)).toEqual(['b'])
  })

  it('lista publicados sem revisão há mais de X meses, mais antigos primeiro', () => {
    const agora = new Date(2026, 6, 1)
    const lista = semRevisao(
      [
        artigo('novo', { revisadoEm: new Date(2026, 5, 1).getTime() }),
        artigo('velho', { revisadoEm: new Date(2025, 0, 1).getTime() }),
        artigo('medio', { revisadoEm: new Date(2026, 0, 1).getTime() }),
        artigo('rasc', { status: 'draft', revisadoEm: 0 }),
      ],
      3,
      agora,
    )
    expect(lista.map((a) => a.id)).toEqual(['velho', 'medio'])
  })
})
