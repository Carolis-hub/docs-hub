import { describe, expect, it } from 'vitest'
import {
  consultasLocais,
  ehPerguntaDeConceito,
  limparPergunta,
  variantesComSinonimos,
} from './consulta'

describe('consulta', () => {
  it('tira as palavras comuns da pergunta', () => {
    expect(limparPergunta('O que é um índice do tipo seleção?')).toBe(
      'índice seleção',
    )
  })
  it('mantém a pergunta quando só há palavras comuns', () => {
    expect(limparPergunta('o que é isso?')).toBe('o que é isso?')
  })
  it('reconhece perguntas de conceito', () => {
    expect(ehPerguntaDeConceito('O que é um índice do tipo seleção?')).toBe(
      true,
    )
    expect(ehPerguntaDeConceito('Para que serve o painel?')).toBe(true)
    expect(ehPerguntaDeConceito('Como publico um documento?')).toBe(false)
  })
  it('troca termos por sinônimos', () => {
    const v = variantesComSinonimos('o que é um índice do tipo seleção')
    expect(v).toContain('metadado selecao')
    expect(v).toContain('indice lista de valores')
  })
  it('consultasLocais começa pela pergunta limpa e não repete', () => {
    const c = consultasLocais('índice consulta')
    expect(c[0]).toBe('índice consulta')
    expect(new Set(c).size).toBe(c.length)
  })
})
