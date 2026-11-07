import { getSchema } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { extensions } from '../components/editor/extensions'
import { CATEGORIAS } from './categorias'
import { extrairTextoPlano } from './content'
import {
  MODELOS,
  mensagemTrechos,
  modeloPorId,
  trechosParaPreencher,
} from './modelos'

describe('modelos de documento', () => {
  const schema = getSchema(extensions)

  it('traz o modelo em branco e um modelo para cada categoria', () => {
    expect(MODELOS.map((m) => m.id)).toEqual([
      'em-branco',
      'funcionalidade',
      'configuracao',
      'processo',
      'regra-de-negocio',
    ])
    const categorias = MODELOS.map((m) => m.categoria).filter(Boolean)
    expect(categorias.sort()).toEqual(CATEGORIAS.map((c) => c.id).sort())
  })

  // O modelo em branco usa o documento vazio do projeto, que o editor completa com um parágrafo.
  it.each(
    MODELOS.filter((m) => m.id !== 'em-branco').map((m) => [m.id, m] as const),
  )(
    '%s: o conteúdo é aceito pelo editor (nós e atributos válidos)',
    (_id, m) => {
      expect(() => schema.nodeFromJSON(m.conteudo).check()).not.toThrow()
    },
  )

  it('os modelos com estrutura têm títulos, trechos para preencher e texto de busca', () => {
    for (const m of MODELOS.filter((x) => x.id !== 'em-branco')) {
      const json = JSON.stringify(m.conteudo)
      expect(json).toContain('"type":"heading"')
      expect(json).toContain('"level":2')
      expect(trechosParaPreencher(m.conteudo), m.id).toBeGreaterThan(3)
      expect(extrairTextoPlano(m.conteudo)).toContain('Preencher')
    }
    expect(trechosParaPreencher(modeloPorId('em-branco')!.conteudo)).toBe(0)
  })

  it('o modelo de funcionalidade, configuração e processo trazem passos numerados e tabela', () => {
    for (const id of ['funcionalidade', 'configuracao', 'processo']) {
      const json = JSON.stringify(modeloPorId(id)!.conteudo)
      expect(json, id).toContain('"type":"orderedList"')
      expect(json, id).toContain('"type":"table"')
    }
  })

  it('modeloPorId ignora ids desconhecidos', () => {
    expect(modeloPorId('nao-existe')).toBeUndefined()
    expect(modeloPorId(null)).toBeUndefined()
  })
})

describe('trechosParaPreencher', () => {
  const p = (t: string) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: t }],
  })

  it('conta os trechos [Preencher: …] em qualquer parte do documento', () => {
    const doc = {
      type: 'doc',
      content: [
        p('Texto pronto.'),
        p('[Preencher: um] e [Preencher: dois]'),
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [p('[Preencher: três]')] }],
        },
      ],
    }
    expect(trechosParaPreencher(doc)).toBe(3)
  })

  it('texto parecido mas sem a marca não conta', () => {
    expect(
      trechosParaPreencher({
        type: 'doc',
        content: [p('Preencher o campo [nome]')],
      }),
    ).toBe(0)
  })

  it('escreve a mensagem no singular e no plural', () => {
    expect(mensagemTrechos(1)).toContain('Ainda há 1 trecho do modelo')
    expect(mensagemTrechos(1)).toContain('apague o trecho')
    expect(mensagemTrechos(4)).toContain('Ainda há 4 trechos do modelo')
    expect(mensagemTrechos(4)).toContain('apague os trechos')
  })
})
