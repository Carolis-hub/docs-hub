import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Block } from '../types/content'
import type { SearchItem } from '../types/search'
import { TEXTO_INDEX_MAX } from '../utils/searchIndex'

vi.mock('./firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  // A referência vira o caminho, para facilitar as asserções.
  doc: (_db: unknown, ...segmentos: string[]) => segmentos.join('/'),
}))
const listProductTree = vi.fn()
vi.mock('./blocks', () => ({
  listProductTree: (...a: unknown[]) => listProductTree(...a),
}))

const { atualizarIndiceTx, itemDoArtigo } = await import('./searchIndex')

const bloco = (id: string, parentId: string | null): Block => ({
  id,
  nome: id,
  slug: id,
  descricao: '',
  icone: '',
  ordem: 0,
  parentId,
  productId: 'p',
})

const item = (id: string, blockId = 'bpm', texto = 'x'): SearchItem => ({
  id,
  titulo: id,
  resumo: '',
  textoPlano: texto,
  blockId,
  publico: 'usuario',
})

function fakeTx(docs: Record<string, unknown>) {
  const escritas: Record<string, unknown> = {}
  return {
    escritas,
    get: vi.fn(async (ref: string) => ({ data: () => docs[ref] })),
    set: vi.fn((ref: string, dados: unknown) => {
      escritas[ref] = dados
    }),
  }
}

beforeEach(() => {
  listProductTree.mockResolvedValue([
    bloco('p', null),
    bloco('bpm', 'p'),
    bloco('ecm', 'p'),
  ])
})

describe('atualizarIndiceTx', () => {
  it('adiciona o item ao documento principal', async () => {
    const tx = fakeTx({ 'searchIndex/p': { itens: [item('a')] } })
    await atualizarIndiceTx(tx as never, 'p', 'bpm', 'b', item('b'))
    expect(
      (tx.escritas['searchIndex/p'] as { itens: SearchItem[] }).itens.map(
        (i) => i.id,
      ),
    ).toEqual(['a', 'b'])
  })

  it('remove o item ao despublicar', async () => {
    const tx = fakeTx({ 'searchIndex/p': { itens: [item('a'), item('b')] } })
    await atualizarIndiceTx(tx as never, 'p', 'bpm', 'a', null)
    expect(
      (tx.escritas['searchIndex/p'] as { itens: SearchItem[] }).itens.map(
        (i) => i.id,
      ),
    ).toEqual(['b'])
  })

  it('cria o índice quando ele ainda não existe', async () => {
    const tx = fakeTx({})
    await atualizarIndiceTx(tx as never, 'p', 'bpm', 'a', item('a'))
    expect(tx.escritas['searchIndex/p']).toEqual({ itens: [item('a')] })
  })

  it('divide por subproduto ao passar do limite', async () => {
    const grande = 'z'.repeat(4000)
    const existentes = Array.from({ length: 200 }, (_, i) =>
      item(`a${i}`, i % 2 ? 'bpm' : 'ecm', grande),
    )
    const tx = fakeTx({ 'searchIndex/p': { itens: existentes } })
    await atualizarIndiceTx(
      tx as never,
      'p',
      'bpm',
      'novo',
      item('novo', 'bpm', grande),
    )

    expect(tx.escritas['searchIndex/p']).toEqual({ itens: [], dividido: true })
    const bpm = tx.escritas['searchIndex/p/partes/bpm'] as {
      itens: SearchItem[]
    }
    const ecm = tx.escritas['searchIndex/p/partes/ecm'] as {
      itens: SearchItem[]
    }
    expect(bpm.itens.length + ecm.itens.length).toBe(201)
    expect(bpm.itens.some((i) => i.id === 'novo')).toBe(true)
  })

  it('com índice dividido, uma parte que estoura o limite tem o texto encurtado em vez de falhar', async () => {
    const grande = 'z'.repeat(4000)
    // ~900 KB só no subproduto "bpm": mais que o limite de um documento.
    const existentes = Array.from({ length: 230 }, (_, i) =>
      item(`a${i}`, 'bpm', grande),
    )
    const tx = fakeTx({
      'searchIndex/p': { itens: [], dividido: true },
      'searchIndex/p/partes/bpm': { itens: existentes },
    })
    await atualizarIndiceTx(
      tx as never,
      'p',
      'bpm',
      'novo',
      item('novo', 'bpm', grande),
    )
    const parte = tx.escritas['searchIndex/p/partes/bpm'] as {
      itens: SearchItem[]
    }
    expect(parte.itens).toHaveLength(231)
    expect(
      new TextEncoder().encode(JSON.stringify(parte)).length,
    ).toBeLessThanOrEqual(800_000)
    expect(parte.itens.every((i) => i.titulo.length > 0)).toBe(true)
    expect(parte.itens[0]!.textoPlano.length).toBeLessThan(4000)
  })

  it('com índice dividido, grava só a parte do subproduto', async () => {
    const tx = fakeTx({
      'searchIndex/p': { itens: [], dividido: true },
      'searchIndex/p/partes/bpm': { itens: [item('a')] },
    })
    await atualizarIndiceTx(tx as never, 'p', 'bpm', 'b', item('b'))
    expect(Object.keys(tx.escritas)).toEqual(['searchIndex/p/partes/bpm'])
    expect(
      (tx.escritas['searchIndex/p/partes/bpm'] as { itens: SearchItem[] })
        .itens,
    ).toHaveLength(2)
  })
})

describe('atualizarIndiceTx: artigos técnicos ficam em coleção própria', () => {
  const tecnico = (id: string): SearchItem => ({
    ...item(id),
    publico: 'tecnico',
  })

  it('artigo técnico vai só para o índice técnico', async () => {
    const tx = fakeTx({ 'searchIndex/p': { itens: [item('a')] } })
    await atualizarIndiceTx(tx as never, 'p', 'bpm', 't', tecnico('t'))
    expect(Object.keys(tx.escritas)).toEqual(['searchIndexTecnico/p'])
    expect(tx.escritas['searchIndexTecnico/p']).toEqual({
      itens: [tecnico('t')],
    })
  })

  it('artigo comum não cria índice técnico', async () => {
    const tx = fakeTx({})
    await atualizarIndiceTx(tx as never, 'p', 'bpm', 'a', item('a'))
    expect(Object.keys(tx.escritas)).toEqual(['searchIndex/p'])
  })

  it('ao virar técnico, sai do índice comum (e vice-versa)', async () => {
    const tx = fakeTx({ 'searchIndex/p': { itens: [item('a'), item('b')] } })
    await atualizarIndiceTx(tx as never, 'p', 'bpm', 'a', tecnico('a'))
    expect(tx.escritas['searchIndex/p']).toEqual({ itens: [item('b')] })
    expect(tx.escritas['searchIndexTecnico/p']).toEqual({
      itens: [tecnico('a')],
    })

    const volta = fakeTx({
      'searchIndex/p': { itens: [item('b')] },
      'searchIndexTecnico/p': { itens: [tecnico('a')] },
    })
    await atualizarIndiceTx(volta as never, 'p', 'bpm', 'a', item('a'))
    expect(volta.escritas['searchIndexTecnico/p']).toEqual({ itens: [] })
    expect(
      (volta.escritas['searchIndex/p'] as { itens: SearchItem[] }).itens.map(
        (i) => i.id,
      ),
    ).toEqual(['b', 'a'])
  })

  it('despublicar tira o artigo de onde ele estiver', async () => {
    const tx = fakeTx({
      'searchIndex/p': { itens: [item('b')] },
      'searchIndexTecnico/p': { itens: [tecnico('a')] },
    })
    await atualizarIndiceTx(tx as never, 'p', 'bpm', 'a', null)
    expect(tx.escritas).toEqual({ 'searchIndexTecnico/p': { itens: [] } })
  })

  it('lê tudo antes de escrever (exigência das transações)', async () => {
    const tx = fakeTx({ 'searchIndex/p': { itens: [item('a')] } })
    const ordem: string[] = []
    tx.get.mockImplementation(async (ref: string) => {
      ordem.push(`ler ${ref}`)
      return { data: () => undefined }
    })
    tx.set.mockImplementation((ref: string) => {
      ordem.push(`gravar ${ref}`)
    })
    await atualizarIndiceTx(tx as never, 'p', 'bpm', 't', tecnico('t'))
    const primeiraGravacao = ordem.findIndex((o) => o.startsWith('gravar'))
    expect(
      ordem.slice(primeiraGravacao).every((o) => o.startsWith('gravar')),
    ).toBe(true)
  })
})

describe('itemDoArtigo', () => {
  it('trunca o texto para caber no índice', () => {
    const r = itemDoArtigo({
      id: 'a',
      titulo: 't',
      resumo: 'r',
      textoPlano: 'x'.repeat(TEXTO_INDEX_MAX + 5000),
      blockId: 'b',
      publico: 'usuario',
    })
    expect(r.textoPlano).toHaveLength(TEXTO_INDEX_MAX)
  })
})
