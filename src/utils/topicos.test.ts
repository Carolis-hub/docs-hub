import { describe, expect, it } from 'vitest'
import { extrairTopicos } from './topicos'

describe('extrairTopicos', () => {
  it('lista só os títulos, com o nível', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Intro' }] },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [
            { type: 'text', text: 'Antes de ' },
            { type: 'text', text: 'começar', marks: [{ type: 'bold' }] },
          ],
        },
        { type: 'heading', attrs: { level: 3 }, content: [] },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Passo 1' }],
        },
      ],
    }
    expect(extrairTopicos(doc)).toEqual([
      { texto: 'Antes de começar', nivel: 2 },
      { texto: 'Passo 1', nivel: 3 },
    ])
  })
  it('documento vazio não tem tópicos', () => {
    expect(extrairTopicos(undefined)).toEqual([])
  })
})
