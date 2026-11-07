import { describe, expect, it } from 'vitest'
import {
  acoesDisponiveis,
  exigeComentario,
  proximoEstado,
  rotuloDaAcao,
  type AcaoCiclo,
  type EstadoCiclo,
} from './ciclo'

describe('ciclo de vida', () => {
  it('só um documento aprovado pode ser publicado', () => {
    const estados: EstadoCiclo[] = [
      'draft',
      'review',
      'approved',
      'published',
      'rejected',
      'archived',
    ]
    const podem = estados.filter(
      (e) => proximoEstado(e, 'publicar') === 'published',
    )
    expect(podem).toEqual(['approved'])
  })

  it('caminho feliz: rascunho → revisão → aprovado → publicado', () => {
    let e: EstadoCiclo = 'draft'
    for (const acao of ['enviar', 'aprovar', 'publicar'] as AcaoCiclo[]) {
      const prox = proximoEstado(e, acao)
      expect(prox, `${acao} a partir de ${e}`).not.toBeNull()
      e = prox as EstadoCiclo
    }
    expect(e).toBe('published')
  })

  it('reprovado volta para revisão (reenvio) ou para rascunho', () => {
    expect(proximoEstado('review', 'reprovar')).toBe('rejected')
    expect(proximoEstado('rejected', 'enviar')).toBe('review')
    expect(proximoEstado('rejected', 'reabrir')).toBe('draft')
  })

  it('aprovar só vale em revisão e não se pula a revisão', () => {
    expect(proximoEstado('draft', 'aprovar')).toBeNull()
    expect(proximoEstado('rejected', 'aprovar')).toBeNull()
    expect(proximoEstado('draft', 'publicar')).toBeNull()
  })

  it('arquivar tira do ar e restaurar devolve como rascunho', () => {
    expect(proximoEstado('published', 'arquivar')).toBe('archived')
    expect(proximoEstado('archived', 'restaurar')).toBe('draft')
    expect(proximoEstado('archived', 'publicar')).toBeNull()
    expect(proximoEstado('published', 'despublicar')).toBe('draft')
  })

  it('lista as ações de cada estado na ordem dos botões', () => {
    expect(acoesDisponiveis('draft')).toEqual(['enviar', 'arquivar'])
    expect(acoesDisponiveis('review')).toEqual([
      'aprovar',
      'reprovar',
      'reabrir',
    ])
    expect(acoesDisponiveis('approved')).toEqual(['publicar', 'reabrir'])
    expect(acoesDisponiveis('rejected')).toEqual(['enviar', 'reabrir'])
    expect(acoesDisponiveis('published')).toEqual(['despublicar', 'arquivar'])
    expect(acoesDisponiveis('archived')).toEqual(['restaurar'])
  })

  it('uma alteração pendente não pode ser despublicada nem arquivada', () => {
    expect(acoesDisponiveis('draft', { revisao: true })).toEqual(['enviar'])
    expect(acoesDisponiveis('approved', { revisao: true })).toEqual([
      'publicar',
      'reabrir',
    ])
  })

  it('só reprovar exige comentário', () => {
    expect(exigeComentario('reprovar')).toBe(true)
    expect(exigeComentario('aprovar')).toBe(false)
    expect(rotuloDaAcao('reprovar')).toContain('ajustes')
  })
})
