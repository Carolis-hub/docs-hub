import { describe, expect, it } from 'vitest'
import {
  ASIDE_PADRAO,
  deModoLegado,
  entradasDaAside,
  normalizarPreferencias,
} from './preferencias'

describe('preferências do usuário', () => {
  it('sem nada salvo, vale o padrão (aside completa)', () => {
    expect(normalizarPreferencias(undefined).aside).toEqual(ASIDE_PADRAO)
    expect(normalizarPreferencias({}).aside).toEqual(ASIDE_PADRAO)
  })

  it('aproveita o que está salvo e completa o que falta', () => {
    expect(
      normalizarPreferencias({ aside: { visivel: true, busca: false } }).aside,
    ).toEqual({ visivel: true, manual: true, busca: false })
  })

  it('ignora valores que não são verdadeiro ou falso', () => {
    expect(
      normalizarPreferencias({ aside: { visivel: 'não', manual: 0 } }).aside,
    ).toEqual(ASIDE_PADRAO)
  })

  it('converte o modo antigo guardado no navegador', () => {
    expect(deModoLegado('manual')?.aside).toEqual({
      visivel: true,
      manual: true,
      busca: false,
    })
    expect(deModoLegado('oculta')?.aside.visivel).toBe(false)
    expect(deModoLegado('qualquer')).toBeNull()
    expect(deModoLegado(null)).toBeNull()
  })

  it('as entradas seguem a escolha de cada pessoa', () => {
    expect(
      entradasDaAside({ visivel: true, manual: true, busca: true }),
    ).toEqual(['manual', 'busca'])
    expect(
      entradasDaAside({ visivel: true, manual: false, busca: true }),
    ).toEqual(['busca'])
    expect(
      entradasDaAside({ visivel: false, manual: true, busca: true }),
    ).toEqual([])
    expect(
      entradasDaAside({ visivel: true, manual: false, busca: false }),
    ).toEqual([])
  })
})
