import { describe, expect, it } from 'vitest'
import { conferirManual } from './padraoManual'

const codigos = (t: string, md: string) =>
  conferirManual(t, md).map((p) => p.codigo)

const bom = `Acompanhe suas tarefas.

## Antes de começar

O módulo **Tarefas** precisa estar ativo.

## Situação

| Situação | Significa |
| -------- | --------- |
| No prazo | Dentro do prazo |

![Painel Minhas Tarefas com a contagem por situação](https://cdn.test/a.png)
`

describe('conferirManual', () => {
  it('um artigo no padrão não tem problemas', () => {
    expect(conferirManual('Minhas Tarefas', bom)).toEqual([])
  })

  it('aponta parágrafo longo e texto sem seções', () => {
    const longo = 'Palavra '.repeat(100)
    const md = `${longo}\n\n${longo}\n\n${longo}`
    expect(codigos('Tarefas', md)).toEqual(
      expect.arrayContaining(['paragrafo-longo', 'sem-secoes']),
    )
  })

  it('aponta definições em parágrafos soltos', () => {
    const md = '**A:** um\n\n**B:** dois\n\n**C:** três'
    expect(codigos('X', md)).toContain('definicoes-em-paragrafos')
    expect(codigos('X', '**A:** um\n\n**B:** dois')).not.toContain(
      'definicoes-em-paragrafos',
    )
  })

  it('aponta imagens sem alt útil (vazio, "IMG:", genérico)', () => {
    expect(codigos('X', '![](a.png)')).toContain('imagem-sem-alt')
    expect(codigos('X', '![IMG: ](a.png)')).toContain('imagem-sem-alt')
    expect(codigos('X', '![Imagem 1 do artigo Tarefas](a.png)')).toContain(
      'imagem-sem-alt',
    )
    expect(codigos('X', '![Tela de tarefas](a.png)')).not.toContain(
      'imagem-sem-alt',
    )
  })

  it('aponta figura por posição e CAIXA ALTA', () => {
    const md = 'Como mostrado na figura abaixo: NO PRAZO, EM RISCO, ATRASADAS.'
    expect(codigos('X', md)).toEqual(
      expect.arrayContaining(['figura-por-posicao', 'caixa-alta']),
    )
  })

  it('procedimento "Como…" precisa de passos numerados', () => {
    expect(codigos('Como acompanhar tarefas', 'Texto.')).toContain(
      'procedimento-sem-passos',
    )
    expect(
      codigos('Como acompanhar tarefas', '1. Clique em **Tarefas**.'),
    ).not.toContain('procedimento-sem-passos')
    expect(codigos('Tarefas', 'Texto.')).not.toContain(
      'procedimento-sem-passos',
    )
  })

  it('pré-requisito só no fim é apontado; no começo, não', () => {
    const fim =
      'Veja o painel.\n\nCada item mostra um número.\n\nOutro detalhe.\n\nO módulo BPM deverá estar ativo na licença.'
    expect(codigos('X', fim)).toContain('pre-requisito-no-fim')
    const inicio =
      'O módulo BPM deverá estar ativo na licença.\n\nCada item mostra um número.\n\nOutro detalhe.\n\nFim.'
    expect(codigos('X', inicio)).not.toContain('pre-requisito-no-fim')
  })

  it('ignora o que está em bloco de código', () => {
    const md = '```\n![](a.png)\nFIGURA ABAIXO NO PRAZO EM RISCO ATRASADAS\n```'
    expect(conferirManual('X', md)).toEqual([])
  })
})
