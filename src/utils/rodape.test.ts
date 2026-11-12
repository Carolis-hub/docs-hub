import { describe, expect, it } from 'vitest'
import { mover, normalizarRodape, temRodape, urlDoRodape } from './rodape'

const item = (titulo: string, extra = {}) => ({
  id: titulo,
  titulo,
  url: '',
  conteudo: '',
  ...extra,
})

describe('normalizarRodape', () => {
  it('sem configuração (ou vazio) não há rodapé', () => {
    expect(normalizarRodape(undefined)).toBeNull()
    expect(normalizarRodape({ colunas: [] })).toBeNull()
    expect(
      normalizarRodape({
        colunas: [{ id: 'c', titulo: ' ', itens: [item('  ')] }],
      }),
    ).toBeNull()
    expect(temRodape(null)).toBe(false)
  })

  it('mantém colunas e itens, descarta itens sem título e links inseguros', () => {
    const r = normalizarRodape({
      colunas: [
        {
          id: 'c1',
          titulo: ' Compatibilidade ',
          itens: [
            item('Compatibilidade DI', { url: '/b/abc' }),
            item('Ruim', { url: 'javascript:alert(1)' }),
            item(''),
          ],
        },
      ],
    })
    expect(r?.colunas[0]?.titulo).toBe('Compatibilidade')
    expect(r?.colunas[0]?.itens.map((i) => [i.titulo, i.url])).toEqual([
      ['Compatibilidade DI', '/b/abc'],
      ['Ruim', ''],
    ])
  })

  it('respeita os limites de tamanho', () => {
    const r = normalizarRodape({
      colunas: [
        {
          id: 'c',
          titulo: 'x'.repeat(500),
          itens: [item('i', { conteudo: 'y'.repeat(9000) })],
        },
      ],
    })
    expect(r?.colunas[0]?.titulo).toHaveLength(80)
    expect(r?.colunas[0]?.itens[0]?.conteudo).toHaveLength(2000)
  })
})

describe('urlDoRodape e mover', () => {
  it('aceita http(s), mailto e caminho interno', () => {
    expect(urlDoRodape('https://a.com')).toBe('https://a.com')
    expect(urlDoRodape('mailto:a@b.com')).toBe('mailto:a@b.com')
    expect(urlDoRodape('/a/123')).toBe('/a/123')
    expect(urlDoRodape('//x.com')).toBe('')
    expect(urlDoRodape('ftp://x')).toBe('')
  })

  it('mover troca com o vizinho e ignora as pontas', () => {
    expect(mover([1, 2, 3], 0, 1)).toEqual([2, 1, 3])
    expect(mover([1, 2, 3], 0, -1)).toEqual([1, 2, 3])
    expect(mover([1, 2, 3], 2, 1)).toEqual([1, 2, 3])
  })
})
