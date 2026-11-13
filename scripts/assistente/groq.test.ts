import { describe, expect, it, vi } from 'vitest'
import {
  configDoAmbiente,
  MODELO_PADRAO,
  MODELO_PADRAO_GROQ,
} from './config.ts'
import { custoEstimado } from './custo.ts'
import { criarProvedorGroq, ErroIA, temChaveNoAmbiente } from './ia.ts'

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function completo(conteudo: unknown, extra: Record<string, unknown> = {}) {
  return {
    model: 'openai/gpt-oss-120b',
    choices: [
      {
        finish_reason: 'stop',
        message: {
          content:
            typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo),
        },
      },
    ],
    usage: { prompt_tokens: 1200, completion_tokens: 80 },
    ...extra,
  }
}

function provedor(fetchFn: typeof fetch, apiKey: string | undefined = 'k') {
  return criarProvedorGroq({
    modelo: 'openai/gpt-oss-120b',
    modeloBusca: 'openai/gpt-oss-20b',
    apiKey,
    fetchFn,
  })
}

describe('provedor da Groq', () => {
  it('planeja: pede JSON, usa o modelo de busca e manda a chave', async () => {
    const f = vi.fn(async () =>
      resposta(completo({ consultas: [' capa DI ', 'quebra', ''] })),
    )
    const r = await provedor(f as unknown as typeof fetch).planejar(
      'como separo um lote?',
      [],
    )
    expect(r.consultas).toEqual(['capa DI', 'quebra'])
    expect(r.uso).toMatchObject({
      entrada: 1200,
      saida: 80,
      gratis: true,
    })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer k',
    )
    const corpo = JSON.parse(init.body as string)
    expect(corpo.model).toBe('openai/gpt-oss-20b')
    expect(corpo.response_format).toEqual({ type: 'json_object' })
    expect(corpo.messages[0].content).toContain('JSON')
    expect(corpo.messages[1].content).toContain('como separo um lote?')
  })

  it('responde com o modelo principal e valida o formato', async () => {
    const f = vi.fn(async () =>
      resposta(
        completo({ encontrou: true, resposta: 'Use a capa [1].', fontes: [1] }),
      ),
    )
    const r = await provedor(f as unknown as typeof fetch).responder(
      'e a capa?',
      [],
      [{ numero: 1, titulo: 'Capa', produto: 'DI', markdown: 'texto' }],
    )
    expect(r.resposta).toEqual({
      encontrou: true,
      resposta: 'Use a capa [1].',
      fontes: [1],
    })
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(JSON.parse(init.body as string).model).toBe('openai/gpt-oss-120b')
  })

  it('o uso gratuito não conta no teto de gasto', async () => {
    const f = vi.fn(async () => resposta(completo({ ids: ['a'] })))
    const r = await provedor(f as unknown as typeof fetch).escolher('p', [])
    expect(custoEstimado(r.uso)).toBe(0)
  })

  it('resposta fora do formato vira erro amigável', async () => {
    const f = vi.fn(async () =>
      resposta(completo({ consultas: 'não é lista' })),
    )
    await expect(
      provedor(f as unknown as typeof fetch).planejar('p', []),
    ).rejects.toThrow(/fora do formato/)
    const g = vi.fn(async () => resposta(completo('isto não é JSON')))
    await expect(
      provedor(g as unknown as typeof fetch).planejar('p', []),
    ).rejects.toBeInstanceOf(ErroIA)
  })

  it('trata limite, chave inválida, erro do servidor e corte por tamanho', async () => {
    const com = (status: number) =>
      provedor(
        vi.fn(async () => resposta({}, status)) as unknown as typeof fetch,
      )
    await expect(com(429).planejar('p', [])).rejects.toThrow(/limite/)
    await expect(com(401).planejar('p', [])).rejects.toThrow(/chave da Groq/)
    await expect(com(500).planejar('p', [])).rejects.toThrow(/HTTP 500/)
    const cortada = vi.fn(async () =>
      resposta(
        completo('{"consultas":["a"]}', {
          choices: [{ finish_reason: 'length', message: { content: '{' } }],
        }),
      ),
    )
    await expect(
      provedor(cortada as unknown as typeof fetch).planejar('p', []),
    ).rejects.toThrow(/cortada/)
  })

  it('falha de rede vira erro amigável', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    await expect(
      provedor(f as unknown as typeof fetch).planejar('p', []),
    ).rejects.toThrow(/Não foi possível falar com a IA/)
  })

  it('sem chave, avisa sem chamar a rede', async () => {
    const antes = process.env.GROQ_API_KEY
    delete process.env.GROQ_API_KEY
    try {
      const f = vi.fn()
      await expect(
        provedor(f as unknown as typeof fetch, '').planejar('p', []),
      ).rejects.toThrow(/chave da Groq/)
      expect(f).not.toHaveBeenCalled()
    } finally {
      if (antes !== undefined) process.env.GROQ_API_KEY = antes
    }
  })
})

describe('escolha do provedor pela configuração', () => {
  it('o padrão continua sendo a Anthropic', () => {
    const c = configDoAmbiente({})
    expect(c.provedor).toBe('anthropic')
    expect(c.modelo).toBe(MODELO_PADRAO)
  })

  it('ASSISTENTE_PROVEDOR=groq troca o provedor e o modelo padrão', () => {
    const c = configDoAmbiente({ ASSISTENTE_PROVEDOR: ' Groq ' })
    expect(c.provedor).toBe('groq')
    expect(c.modelo).toBe(MODELO_PADRAO_GROQ)
    expect(c.modeloBusca).toBe(MODELO_PADRAO_GROQ)
  })

  it('o modelo informado vale para qualquer provedor', () => {
    const c = configDoAmbiente({
      ASSISTENTE_PROVEDOR: 'groq',
      ASSISTENTE_MODELO: 'meu-modelo',
      ASSISTENTE_MODELO_BUSCA: 'modelo-menor',
    })
    expect([c.modelo, c.modeloBusca]).toEqual(['meu-modelo', 'modelo-menor'])
  })

  it('valor desconhecido de provedor cai na Anthropic', () => {
    expect(configDoAmbiente({ ASSISTENTE_PROVEDOR: 'xyz' }).provedor).toBe(
      'anthropic',
    )
  })

  it('confere a chave do provedor escolhido', () => {
    const env = { GROQ_API_KEY: 'g' }
    expect(temChaveNoAmbiente('groq', env)).toBe(true)
    expect(temChaveNoAmbiente('anthropic', env)).toBe(false)
  })
})
