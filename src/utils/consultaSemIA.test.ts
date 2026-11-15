import { describe, expect, it } from 'vitest'
import type { IndexedItem } from '../types/search'
import { consultarSemIA } from './consultaSemIA'
import { criarMotor } from './searchEngine'

const item = (id: string, titulo: string, textoPlano: string): IndexedItem => ({
  id,
  titulo,
  resumo: '',
  textoPlano,
  blockId: 'b1',
  publico: 'usuario',
  productId: id === 'x' ? 'p2' : 'p1',
})

const motor = criarMotor(
  [
    item(
      'dig',
      'Digitalizar documentos',
      'Para digitalizar um documento, abra o módulo de captura e escolha o scanner.',
    ),
    item(
      'idx',
      'Tipos de índice',
      'O índice guarda os metadados do documento.',
    ),
    item('exc', 'Como apagar anexos', 'Selecione o anexo e clique em apagar.'),
    item(
      'x',
      'Digitalizar em lote',
      'Outro produto: digitalizar várias páginas.',
    ),
  ],
  true,
)

describe('consultarSemIA', () => {
  it('acha o artigo de uma pergunta em linguagem natural', () => {
    const r = consultarSemIA(motor, 'como digitalizo um documento', {
      productId: 'p1',
    })
    expect(r[0]?.item.id).toBe('dig')
    expect(r[0]?.trecho.some((p) => p.destaque)).toBe(true)
  })

  it('usa sinônimos (excluir → apagar)', () => {
    expect(
      consultarSemIA(motor, 'como excluir anexos?').map((x) => x.item.id),
    ).toContain('exc')
  })

  it('sem artigo com todas as palavras, aceita os que têm parte delas', () => {
    expect(
      consultarSemIA(motor, 'digitalizar relatório fiscal', {
        productId: 'p1',
      }).map((x) => x.item.id),
    ).toEqual(['dig'])
  })

  it('respeita os filtros e o limite; sem nada parecido, devolve vazio', () => {
    expect(
      consultarSemIA(motor, 'digitalizar', { productId: 'p2' }).map(
        (x) => x.item.id,
      ),
    ).toEqual(['x'])
    expect(consultarSemIA(motor, 'digitalizar', {}, 1)).toHaveLength(1)
    expect(consultarSemIA(motor, 'folha de pagamento')).toEqual([])
  })
})
