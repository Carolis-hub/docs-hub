import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { extrairTextoPlano, gerarResumo } from './conteudo'

const conteudoExemplo: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Como configurar o BPM' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Primeiro, acesse o painel de ' },
        { type: 'text', text: 'administração', marks: [{ type: 'bold' }] },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Passo um' }],
            },
          ],
        },
      ],
    },
  ],
}

describe('extrairTextoPlano', () => {
  it('concatena o texto de todos os nós, ignorando marcas', () => {
    const texto = extrairTextoPlano(conteudoExemplo)
    expect(texto).toContain('Como configurar o BPM')
    expect(texto).toContain('Primeiro, acesse o painel de administração .')
    expect(texto).toContain('Passo um')
  })
})

describe('gerarResumo', () => {
  it('retorna o texto completo quando já é curto', () => {
    expect(gerarResumo('Um resumo curto.')).toBe('Um resumo curto.')
  })

  it('corta no limite de palavra e adiciona reticências', () => {
    const textoLongo = 'palavra '.repeat(50).trim()
    const resumo = gerarResumo(textoLongo, 20)
    expect(resumo.endsWith('…')).toBe(true)
    expect(resumo.length).toBeLessThanOrEqual(21)
  })
})
