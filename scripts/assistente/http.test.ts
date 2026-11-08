import { describe, expect, it, vi } from 'vitest'
import { tratarRequisicao, type DepsHttp } from './http.ts'

const CHAVE = 'sk-ant-' + 'x'.repeat(30)

function deps(extra: Partial<DepsHttp> = {}): DepsHttp {
  return {
    db: {} as never,
    ia: {} as never,
    config: {} as never,
    verificarToken: async () => 'u1',
    ...extra,
  }
}

const base = {
  metodo: 'POST',
  authorization: 'Bearer t',
  corpo: { pergunta: 'O que é um índice?' },
}

describe('tratarRequisicao com chave do usuário', () => {
  it('recusa chave com formato inválido', async () => {
    const r = await tratarRequisicao(deps({ criarProvedor: vi.fn() }), {
      ...base,
      chaveIA: 'curta',
    })
    expect(r.status).toBe(400)
    expect(JSON.stringify(r.corpo)).toContain('chave-invalida')
  })

  it('recusa quando o servidor não sabe montar o provedor', async () => {
    const r = await tratarRequisicao(deps(), { ...base, chaveIA: CHAVE })
    expect(r.status).toBe(400)
  })

  it('monta o provedor com a chave e não a devolve na resposta', async () => {
    const criarProvedor = vi.fn(() => {
      throw new Error('para aqui')
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const r = await tratarRequisicao(deps({ criarProvedor }), {
      ...base,
      chaveIA: CHAVE,
    })
    expect(criarProvedor).toHaveBeenCalledWith(CHAVE)
    expect(JSON.stringify(r.corpo)).not.toContain(CHAVE)
  })
})
