// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  idsReferenciados,
  motivoParaNaoApagar,
  planejarLimpeza,
  publicIdDaUrl,
} from './limpeza.ts'

describe('publicIdDaUrl', () => {
  const base = 'https://res.cloudinary.com/selbetti/image/upload'
  it.each([
    [`${base}/v1712345678/docs/abc123.png`, 'docs/abc123'],
    [`${base}/docs/abc123.gif`, 'docs/abc123'],
    [`${base}/f_auto,q_auto/v12/docs/abc123.png`, 'docs/abc123'],
    [`${base}/w_200/docs/abc123.jpg`, 'docs/abc123'],
    [`${base}/v1/Imagem%20um.png`, 'Imagem um'],
    [`${base}/v1/semextensao`, 'semextensao'],
  ])('%s', (url, id) => {
    expect(publicIdDaUrl(url)).toBe(id)
  })

  it('ignora URLs que não são do Cloudinary ou de outra conta', () => {
    expect(publicIdDaUrl('https://example.com/a.png')).toBeNull()
    expect(publicIdDaUrl('/relativo.png')).toBeNull()
    expect(publicIdDaUrl(`${base}/v1/a.png`, 'outra-conta')).toBeNull()
    expect(
      publicIdDaUrl(
        'https://res.cloudinary.com/selbetti/image/fetch/https://x/a.png',
      ),
    ).toBeNull()
  })
})

const img = (src: string) => ({ type: 'image', attrs: { src, alt: 'x' } })
const doc = (...c: unknown[]) => ({ type: 'doc', content: c as never[] })

describe('idsReferenciados', () => {
  it('junta as imagens de todos os documentos', () => {
    const ids = idsReferenciados([
      doc(img('https://res.cloudinary.com/c/image/upload/v1/a/um.png')),
      doc(
        { type: 'paragraph' },
        img('https://res.cloudinary.com/c/image/upload/v1/a/dois.png'),
      ),
      doc(img('https://externa.com/x.png')),
    ])
    expect([...ids].sort()).toEqual(['a/dois', 'a/um'])
  })
})

describe('planejarLimpeza', () => {
  const agora = new Date('2026-06-30T00:00:00Z')
  const dias = (n: number) =>
    new Date(agora.getTime() - n * 86_400_000).toISOString()
  const recursos = [
    { public_id: 'em-uso', created_at: dias(100), bytes: 10 },
    { public_id: 'orfa-antiga', created_at: dias(30), bytes: 2048 },
    { public_id: 'orfa-recente', created_at: dias(2), bytes: 5 },
  ]

  it('separa em uso, órfãs antigas e órfãs em carência', () => {
    const p = planejarLimpeza(recursos, new Set(['em-uso']), {
      carenciaDias: 7,
      agora,
    })
    expect(p.orfas.map((r) => r.public_id)).toEqual(['orfa-antiga'])
    expect(p).toMatchObject({
      total: 3,
      referenciadas: 1,
      emCarencia: 1,
      bytesLiberados: 2048,
    })
  })

  it('a carência protege uploads recentes', () => {
    const p = planejarLimpeza(recursos, new Set(), { carenciaDias: 60, agora })
    // Com 60 dias de carência, só a de 100 dias pode ser apagada.
    expect(p.orfas.map((r) => r.public_id)).toEqual(['em-uso'])
    expect(p.emCarencia).toBe(2)
  })
})

describe('motivoParaNaoApagar', () => {
  const plano = (
    orfas: number,
    referenciadas: number,
    total = orfas + referenciadas,
  ) => ({
    total,
    referenciadas,
    orfas: Array.from({ length: orfas }, (_, i) => ({
      public_id: `o${i}`,
      created_at: '2020-01-01',
    })),
    emCarencia: 0,
    bytesLiberados: 0,
  })

  it('libera uma limpeza pequena e normal', () => {
    expect(motivoParaNaoApagar(plano(2, 20), 50)).toBeNull()
  })
  it('não há o que apagar: nada a recusar', () => {
    expect(motivoParaNaoApagar(plano(0, 0), 0)).toBeNull()
  })
  it('recusa quando o Firestore não devolveu artigos', () => {
    expect(motivoParaNaoApagar(plano(10, 0), 0)).toMatch(/nenhum artigo/)
  })
  it('recusa quando nada do Cloudinary está referenciado', () => {
    expect(motivoParaNaoApagar(plano(10, 0), 30)).toMatch(/nenhuma imagem/)
  })
  it('recusa apagar mais da metade', () => {
    expect(motivoParaNaoApagar(plano(15, 10), 30)).toMatch(/mais da metade/)
  })
})
