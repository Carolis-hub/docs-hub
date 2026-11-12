import type { JSONContent } from '@tiptap/react'
import { describe, expect, it } from 'vitest'
import { extrairTextoPlano } from './content'
import { dividirEmSecoes, extrairSecoes, melhorSecao } from './secoes'
import { itemDoArtigo } from './searchIndex'

const p = (texto: string): JSONContent => ({
  type: 'paragraph',
  content: [{ type: 'text', text: texto }],
})
const h = (texto: string, level = 2): JSONContent => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text: texto }],
})
const doc: JSONContent = {
  type: 'doc',
  content: [
    p('Introdução ao envio de documentos.'),
    h('Permissões'),
    p('Só o gestor aprova o envio.'),
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [p('Gestor: aprova')] },
        { type: 'listItem', content: [p('Leitor: consulta')] },
      ],
    },
    h('Prazos de aprovação', 3),
    p('O prazo é de dois dias. O prazo conta em dias úteis.'),
    h('   '),
  ],
}
const textoPlano = extrairTextoPlano(doc)

describe('extrairSecoes', () => {
  it('a posição de cada seção cai exatamente no título, dentro do texto plano', () => {
    const secoes = extrairSecoes(doc)
    expect(secoes.map((s) => s.t)).toEqual([
      'Permissões',
      'Prazos de aprovação',
    ])
    for (const s of secoes) {
      expect(textoPlano.slice(s.i).startsWith(s.t)).toBe(true)
    }
  })

  it('artigo que começa por um título: a primeira seção fica na posição 0', () => {
    const d = { type: 'doc', content: [h('Início'), p('Texto.')] }
    expect(extrairSecoes(d)).toEqual([{ t: 'Início', i: 0 }])
  })

  it('sem títulos (ou sem conteúdo) não há seções', () => {
    expect(extrairSecoes({ type: 'doc', content: [p('Só texto.')] })).toEqual(
      [],
    )
    expect(extrairSecoes(undefined)).toEqual([])
  })
})

describe('itemDoArtigo com seções', () => {
  const base = {
    id: 'a',
    titulo: 'Envio',
    resumo: '',
    textoPlano,
    blockId: 'b',
    publico: 'usuario' as const,
  }

  it('leva as seções quando recebe o conteúdo', () => {
    expect(itemDoArtigo({ ...base, conteudo: doc }).secoes).toHaveLength(2)
  })

  it('sem conteúdo ou sem títulos, não grava o campo (economiza o índice)', () => {
    expect('secoes' in itemDoArtigo(base)).toBe(false)
  })

  it('descarta as seções que ficaram depois do corte do texto', () => {
    const longo = {
      type: 'doc',
      content: [h('Começo'), p('x'.repeat(20_000)), h('Fim'), p('y')],
    }
    const item = itemDoArtigo({
      ...base,
      textoPlano: extrairTextoPlano(longo),
      conteudo: longo,
    })
    expect(item.secoes).toEqual([{ t: 'Começo', i: 0 }])
  })
})

describe('dividirEmSecoes e melhorSecao', () => {
  const item = { textoPlano, secoes: extrairSecoes(doc) }

  it('divide em introdução e seções, sem perder texto', () => {
    const partes = dividirEmSecoes(item)
    expect(partes.map((s) => s.titulo)).toEqual([
      '',
      'Permissões',
      'Prazos de aprovação',
    ])
    expect(partes[1]!.texto).toContain('Leitor: consulta')
    expect(partes[1]!.texto).not.toContain('prazo')
  })

  it('item antigo, sem seções, vira um trecho só', () => {
    expect(dividirEmSecoes({ textoPlano: 'abc' })).toEqual([
      { titulo: '', texto: 'abc' },
    ])
  })

  it('texto encurtado no índice ignora as seções que sumiram', () => {
    const curto = { textoPlano: textoPlano.slice(0, 50), secoes: item.secoes }
    expect(dividirEmSecoes(curto).map((s) => s.titulo)).toEqual([
      '',
      'Permissões',
    ])
  })

  it('escolhe a seção com mais termos da busca', () => {
    expect(melhorSecao(item, ['prazo', 'dias'])?.titulo).toBe(
      'Prazos de aprovação',
    )
    expect(melhorSecao(item, ['gestor'])?.titulo).toBe('Permissões')
  })

  it('ignora acentos e maiúsculas', () => {
    expect(melhorSecao(item, ['PERMISSOES'])?.titulo).toBe('Permissões')
  })

  it('se só a introdução casa (ou nada casa), não aponta seção', () => {
    expect(melhorSecao(item, ['introducao'])).toBeUndefined()
    expect(melhorSecao(item, ['inexistente'])).toBeUndefined()
    expect(melhorSecao(item, [])).toBeUndefined()
  })
})
