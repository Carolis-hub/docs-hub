import { describe, expect, it } from 'vitest'
import {
  extrairImagens,
  extrairLinks,
  extrairTextoPlano,
  gerarResumo,
  imagensSemAlt,
} from './content'
import { slugify } from './slug'
import { validarArquivoMidia } from './media'

const doc = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Fluxo de aprovação' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Abra o ' },
        { type: 'text', text: 'BPM', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' e clique em Iniciar.' },
      ],
    },
    { type: 'image', attrs: { src: 'x.gif', alt: 'Tela inicial' } },
  ],
}

describe('extrairTextoPlano', () => {
  it('junta os textos por bloco e inclui o alt das imagens', () => {
    expect(extrairTextoPlano(doc)).toBe(
      'Fluxo de aprovação\nAbra o BPM e clique em Iniciar.\nTela inicial',
    )
  })
})

describe('gerarResumo', () => {
  it('mantém textos curtos', () => {
    expect(gerarResumo('Olá\nmundo')).toBe('Olá mundo')
  })
  it('corta em palavra e adiciona reticências', () => {
    const r = gerarResumo('palavra '.repeat(50), 40)
    expect(r.endsWith('…')).toBe(true)
    expect(r.length).toBeLessThanOrEqual(41)
  })
})

describe('imagensSemAlt', () => {
  it('conta imagens sem texto alternativo', () => {
    const d = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: 'a', alt: '' } },
        { type: 'image', attrs: { src: 'b', alt: '  ' } },
        { type: 'image', attrs: { src: 'c', alt: 'ok' } },
      ],
    }
    expect(imagensSemAlt(d)).toBe(2)
  })
})

describe('slugify', () => {
  it('remove acentos e símbolos', () => {
    expect(slugify('  Gestão de Processos (BPM)! ')).toBe(
      'gestao-de-processos-bpm',
    )
  })
})

describe('validarArquivoMidia', () => {
  it('aceita gif pequeno', () => {
    expect(validarArquivoMidia({ type: 'image/gif', size: 1000 })).toBeNull()
  })
  it('rejeita formato inválido', () => {
    expect(validarArquivoMidia({ type: 'image/svg+xml', size: 10 })).toMatch(
      /formato/i,
    )
  })
  it('rejeita arquivo acima de 5 MB', () => {
    expect(
      validarArquivoMidia({ type: 'image/png', size: 6 * 1024 * 1024 }),
    ).toMatch(/5 MB/)
  })
})

describe('extrairImagens e extrairLinks', () => {
  const d = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'a',
            marks: [{ type: 'link', attrs: { href: 'https://x.com' } }],
          },
          { type: 'text', text: 'b', marks: [{ type: 'bold' }] },
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
                content: [
                  {
                    type: 'text',
                    text: 'c',
                    marks: [{ type: 'link', attrs: { href: '/a/1' } }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: 'image', attrs: { src: 'https://img/1.png', alt: 'um' } },
      { type: 'image', attrs: { src: '', alt: 'vazia' } },
    ],
  }
  it('lista os endereços em qualquer profundidade', () => {
    expect(extrairLinks(d)).toEqual(['https://x.com', '/a/1'])
    expect(extrairImagens(d)).toEqual(['https://img/1.png'])
  })
})
