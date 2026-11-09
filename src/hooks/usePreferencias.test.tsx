import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { limparPreferenciasEmMemoria, usePreferencias } from './usePreferencias'

const lerPreferencias = vi.fn()
const salvarPreferencias = vi.fn()

vi.mock('../services/preferencias', () => ({
  lerPreferencias: (...a: unknown[]) => lerPreferencias(...a),
  salvarPreferencias: (...a: unknown[]) => salvarPreferencias(...a),
}))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  limparPreferenciasEmMemoria()
  lerPreferencias.mockResolvedValue(null)
  salvarPreferencias.mockResolvedValue(undefined)
})

describe('usePreferencias', () => {
  it('sem nada salvo, a aside vem completa', () => {
    const { result } = renderHook(() => usePreferencias('u1'))
    expect(result.current.aside).toEqual({
      visivel: true,
      manual: true,
      busca: true,
    })
  })

  it('traz da conta o que a pessoa já configurou', async () => {
    lerPreferencias.mockResolvedValue({
      aside: { visivel: true, manual: false, busca: true },
    })
    const { result } = renderHook(() => usePreferencias('u1'))
    await waitFor(() => expect(result.current.aside.manual).toBe(false))
    expect(lerPreferencias).toHaveBeenCalledWith('u1')
  })

  it('aproveita o modo antigo guardado neste navegador', () => {
    localStorage.setItem('docshub.aside.u1', 'busca')
    const { result } = renderHook(() => usePreferencias('u1'))
    expect(result.current.aside).toEqual({
      visivel: true,
      manual: false,
      busca: true,
    })
  })

  it('cada pessoa tem a sua configuração', async () => {
    lerPreferencias.mockImplementation(async (uid: string) =>
      uid === 'a'
        ? { aside: { visivel: false, manual: true, busca: true } }
        : null,
    )
    const a = renderHook(() => usePreferencias('a'))
    const b = renderHook(() => usePreferencias('b'))
    await waitFor(() => expect(a.result.current.aside.visivel).toBe(false))
    expect(b.result.current.aside.visivel).toBe(true)
  })

  it('mudar mostra na hora e grava na conta', async () => {
    const { result } = renderHook(() => usePreferencias('u1'))
    await act(() => result.current.atualizarAside({ busca: false }))
    expect(result.current.aside).toEqual({
      visivel: true,
      manual: true,
      busca: false,
    })
    expect(salvarPreferencias).toHaveBeenCalledWith('u1', {
      aside: { visivel: true, manual: true, busca: false },
    })
  })

  it('duas telas usando o hook veem a mesma mudança', async () => {
    const a = renderHook(() => usePreferencias('u1'))
    const b = renderHook(() => usePreferencias('u1'))
    await act(() => a.result.current.atualizarAside({ visivel: false }))
    expect(b.result.current.aside.visivel).toBe(false)
  })

  it('se não conseguir gravar, avisa e mantém a escolha neste navegador', async () => {
    salvarPreferencias.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => usePreferencias('u1'))
    await act(() => result.current.atualizarAside({ manual: false }))
    expect(result.current.erro).toMatch(/Não foi possível salvar/)
    expect(result.current.aside.manual).toBe(false)
  })
})
