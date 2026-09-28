import { describe, expect, it } from 'vitest'
import { itemDoArtigo } from './searchIndex'
import type { Article } from '../types/article'

const artigoExemplo: Article = {
  id: 'artigo-1',
  blockId: 'bpm',
  productId: 'smartshare',
  titulo: 'Como configurar um fluxo',
  slug: 'como-configurar-um-fluxo',
  resumo: 'Resumo do artigo',
  conteudo: { type: 'doc', content: [] },
  textoPlano: 'x'.repeat(2000),
  publico: 'usuario',
  versaoProduto: null,
  status: 'published',
  flags: [],
  views: 0,
  versao: 1,
  autorId: 'admin-1',
  atualizadoPor: 'admin-1',
  criadoEm: 0,
  atualizadoEm: 0,
  revisadoEm: null,
}

describe('itemDoArtigo', () => {
  it('copia os campos relevantes para o índice de busca', () => {
    const item = itemDoArtigo(artigoExemplo)
    expect(item).toMatchObject({
      id: 'artigo-1',
      titulo: 'Como configurar um fluxo',
      resumo: 'Resumo do artigo',
      blockId: 'bpm',
      publico: 'usuario',
    })
  })

  it('trunca o textoPlano para não deixar o índice grande demais', () => {
    const item = itemDoArtigo(artigoExemplo)
    expect(item.textoPlano.length).toBe(1000)
  })
})
