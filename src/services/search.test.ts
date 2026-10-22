import { describe, expect, it, vi } from 'vitest'
import type { IndexedItem } from '../types/search'

vi.mock('./firebase', () => ({ db: {} }))
vi.mock('./searchIndex', () => ({ lerIndiceDoProduto: vi.fn() }))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  increment: vi.fn(),
  setDoc: vi.fn(),
}))

const { criarMotor } = await import('./search')

const item = (over: Partial<IndexedItem>): IndexedItem => ({
  id: 'x',
  titulo: '',
  resumo: '',
  textoPlano: '',
  blockId: 'b',
  publico: 'usuario',
  productId: 'p1',
  ...over,
})

const itens = [
  item({
    id: 'a1',
    titulo: 'Configuração do fluxo',
    textoPlano: 'Passos para aprovar documentos no BPM.',
  }),
  item({
    id: 'a2',
    titulo: 'Guia geral',
    textoPlano: 'Aqui falamos da configuração inicial do sistema.',
  }),
  item({
    id: 'a3',
    titulo: 'API de integração',
    textoPlano: 'Endpoints REST do servidor.',
    publico: 'tecnico',
    productId: 'p2',
  }),
]

describe('motor de busca', () => {
  const motor = criarMotor(itens, true)

  it('encontra por conteúdo e por título', () => {
    expect(motor.buscar('aprovar').map((r) => r.item.id)).toEqual(['a1'])
    expect(motor.buscar('guia').map((r) => r.item.id)).toEqual(['a2'])
  })

  it('ignora acentos e aceita prefixo', () => {
    expect(motor.buscar('configuracao').map((r) => r.item.id)).toContain('a1')
    expect(motor.buscar('configur').length).toBe(2)
  })

  it('tolera erro de digitação (fuzzy)', () => {
    expect(motor.buscar('integracaao').map((r) => r.item.id)).toEqual(['a3'])
  })

  it('dá mais peso ao título do que ao conteúdo', () => {
    const [primeiro] = motor.buscar('configuracao')
    expect(primeiro?.item.id).toBe('a1')
  })

  it('filtra por produto e por público', () => {
    expect(motor.buscar('configuracao', { productId: 'p2' })).toEqual([])
    expect(motor.buscar('api', { publico: 'tecnico' })).toHaveLength(1)
    expect(motor.buscar('api', { publico: 'usuario' })).toEqual([])
  })

  it('esconde artigos técnicos de quem não pode vê-los', () => {
    const leitor = criarMotor(itens, false)
    expect(leitor.total).toBe(2)
    expect(leitor.buscar('api')).toEqual([])
  })

  it('consulta vazia não retorna nada', () => {
    expect(motor.buscar('   ')).toEqual([])
  })
})
