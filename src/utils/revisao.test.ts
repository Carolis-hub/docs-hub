import { describe, expect, it } from 'vitest'
import type { Article, Block } from '../types/content'
import { caminhoDoBloco, rascunhoDoArtigo, rotuloDoStatus } from './revisao'

const bloco = (id: string, nome: string, parentId: string | null): Block => ({
  id,
  nome,
  slug: id,
  descricao: '',
  icone: '',
  ordem: 0,
  parentId,
  productId: 'p',
})

describe('revisao', () => {
  const blocos = [
    bloco('p', 'SmartShare 4', null),
    bloco('s', 'Anexos', 'p'),
    bloco('ss', 'Limites', 's'),
  ]

  it('monta o caminho do produto até o bloco', () => {
    expect(caminhoDoBloco(blocos, 'ss')).toBe('SmartShare 4 › Anexos › Limites')
    expect(caminhoDoBloco(blocos, 'p')).toBe('SmartShare 4')
  })

  it('devolve vazio para bloco inexistente e não entra em laço', () => {
    expect(caminhoDoBloco(blocos, 'x')).toBe('')
    const laco = [bloco('a', 'A', 'b'), bloco('b', 'B', 'a')]
    expect(caminhoDoBloco(laco, 'a')).toBe('B › A')
  })

  it('o rascunho do artigo mantém os campos editáveis', () => {
    const a = {
      titulo: 'T',
      conteudo: { type: 'doc' },
      publico: 'tecnico',
      versaoProduto: '4.1',
    } as Article
    expect(rascunhoDoArtigo(a)).toEqual({
      titulo: 'T',
      conteudo: { type: 'doc' },
      publico: 'tecnico',
      categoria: '',
      versaoProduto: '4.1',
    })
  })

  it('traduz o status', () => {
    expect(rotuloDoStatus('review')).toBe('Em revisão')
    expect(rotuloDoStatus('draft')).toBe('Rascunho')
    expect(rotuloDoStatus('published')).toBe('Publicado')
  })
})
