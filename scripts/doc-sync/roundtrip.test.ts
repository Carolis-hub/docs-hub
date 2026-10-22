// @vitest-environment node
import type { JSONContent } from '@tiptap/react'
import { describe, expect, it } from 'vitest'
import { extrairTextoPlano } from '../../src/utils/content.ts'
import { docParaMarkdown } from '../../src/utils/tiptapMarkdown.ts'
import { converter } from '../migrate/convert.ts'

const t = (text: string, marks?: JSONContent['marks']): JSONContent => ({
  type: 'text',
  text,
  ...(marks ? { marks } : {}),
})
const p = (...c: JSONContent[]): JSONContent => ({
  type: 'paragraph',
  content: c,
})

const doc: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [t('Visão geral')] },
    p(
      t('Abra o '),
      t('BPM', [{ type: 'bold' }]),
      t(' e use '),
      t('Ctrl+K', [{ type: 'code' }]),
      t(' ou veja '),
      t('a ajuda', [{ type: 'link', attrs: { href: '/a/m-ajuda' } }]),
      t('.'),
    ),
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [p(t('primeiro'))] },
        {
          type: 'listItem',
          content: [
            p(t('segundo')),
            {
              type: 'orderedList',
              attrs: { start: 1 },
              content: [
                { type: 'listItem', content: [p(t('sub 1'))] },
                { type: 'listItem', content: [p(t('sub 2'))] },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'codeBlock',
      attrs: { language: 'sql' },
      content: [t('select 1;')],
    },
    {
      type: 'image',
      attrs: { src: 'https://cdn.test/a.png', alt: 'Tela inicial' },
    },
    p(t('Use * e _ com cuidado: [colchetes] e <tags>.')),
  ],
}

const identidade = {
  titulo: 'T',
  resolverImagem: async (src: string) => ({ url: src }),
  resolverLink: async (href: string) => ({ tipo: 'manter' as const, href }),
  aoFalharImagem: () => {},
  aoGerarAlt: () => {},
  aoQuebrarLink: () => {},
}

function tipos(no: JSONContent): string[] {
  return [no.type ?? '', ...(no.content ?? []).flatMap(tipos)]
}

describe('docParaMarkdown', () => {
  it('serializa os nós do editor', () => {
    const md = docParaMarkdown(doc)
    expect(md).toContain('## Visão geral')
    expect(md).toContain('Abra o **BPM** e use `Ctrl+K`')
    expect(md).toContain('[a ajuda](/a/m-ajuda)')
    expect(md).toContain('- primeiro\n- segundo\n  1. sub 1\n  2. sub 2')
    expect(md).toContain('```sql\nselect 1;\n```')
    expect(md).toContain('![Tela inicial](https://cdn.test/a.png)')
    expect(md).toContain(
      'Use \\* e \\_ com cuidado: \\[colchetes\\] e \\<tags\\>.',
    )
  })

  it('mantém os espaços fora das marcas', () => {
    const md = docParaMarkdown({
      type: 'doc',
      content: [p(t('um '), t(' negrito ', [{ type: 'bold' }]), t('fim'))],
    })
    expect(md).toBe('um  **negrito** fim\n')
  })
})

describe('ida e volta (doc → Markdown → doc)', () => {
  it('preserva a estrutura, o texto, os links e as imagens', async () => {
    const { doc: volta } = await converter(
      docParaMarkdown(doc),
      'markdown',
      identidade,
    )
    expect(extrairTextoPlano(volta)).toBe(extrairTextoPlano(doc))
    expect(
      tipos(volta)
        .filter((x) => x !== 'doc')
        .sort(),
    ).toEqual(
      tipos(doc)
        .filter((x) => x !== 'doc')
        .sort(),
    )
    const json = JSON.stringify(volta)
    expect(json).toContain('"href":"/a/m-ajuda"')
    expect(json).toContain('"src":"https://cdn.test/a.png"')
    expect(json).toContain('"alt":"Tela inicial"')
    expect(json).toContain('"language":"sql"')
  })

  it('é estável: uma segunda volta gera o mesmo Markdown', async () => {
    const md1 = docParaMarkdown(doc)
    const { doc: volta } = await converter(md1, 'markdown', identidade)
    expect(docParaMarkdown(volta)).toBe(md1)
  })
})
