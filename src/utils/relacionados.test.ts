import { describe, expect, it } from 'vitest'
import type { IndexedItem } from '../types/search'
import { relacionados } from './relacionados'
import { criarMotor } from './searchEngine'

const item = (
  id: string,
  titulo: string,
  extra: Partial<IndexedItem> = {},
): IndexedItem => ({
  id,
  titulo,
  resumo: '',
  textoPlano: titulo,
  blockId: 'b1',
  publico: 'usuario',
  productId: 'p1',
  ...extra,
})

describe('relacionados', () => {
  const motor = criarMotor(
    [
      item('base', 'Configurar envio de e-mail'),
      item('r1', 'Configurar o servidor de e-mail', { blockId: 'b1' }),
      item('r2', 'Enviar e-mail em lote', { blockId: 'b2' }),
      item('longe', 'Regras de aprovação de contratos'),
      item('outro', 'Configurar envio de e-mail', { productId: 'p2' }),
    ],
    true,
  )
  const base = {
    id: 'base',
    titulo: 'Configurar envio de e-mail',
    resumo: '',
    blockId: 'b1',
    productId: 'p1',
  }

  it('acha os parecidos do mesmo produto, sem o próprio artigo nem os de outro produto', () => {
    const ids = relacionados(motor, base).map((i) => i.id)
    expect(ids).toContain('r1')
    expect(ids).toContain('r2')
    expect(ids).not.toContain('base')
    expect(ids).not.toContain('outro')
    expect(ids).not.toContain('longe')
  })

  it('o do mesmo bloco vem antes do de outro bloco', () => {
    expect(relacionados(motor, base).map((i) => i.id)).toEqual(['r1', 'r2'])
  })

  it('respeita o limite e devolve vazio sem texto para comparar', () => {
    expect(relacionados(motor, base, 1)).toHaveLength(1)
    expect(relacionados(motor, { ...base, titulo: '', resumo: '' })).toEqual([])
  })
})
