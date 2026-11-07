import { describe, expect, it } from 'vitest'
import { classificarDocumento } from './classificar'

const base = { titulo: 'Documento', caminho: 'doc.md', texto: 'Texto simples.' }

describe('classificarDocumento', () => {
  it('reconhece configuração pelo título e pelo caminho', () => {
    const r = classificarDocumento({
      titulo: 'Como configurar o envio de e-mail',
      caminho: 'configuracoes/email.md',
      texto: '# Configurar\nAbra a tela e habilite a opção.',
    })
    expect(r.categoria).toBe('configuracoes')
    expect(r.confianca).toBe('alta')
    expect(r.publico).toBe('usuario')
  })

  it('reconhece processo e regra de negócio', () => {
    expect(
      classificarDocumento({
        ...base,
        titulo: 'Passo a passo da aprovação',
        texto: '## Etapa 1\nEnvie para o fluxo.',
      }).categoria,
    ).toBe('processos')
    expect(
      classificarDocumento({
        ...base,
        titulo: 'Regras de validação do cadastro',
        caminho: 'regras/validacao.md',
      }).categoria,
    ).toBe('regras-de-negocio')
  })

  it('sem sinal claro, deixa a categoria vazia com confiança baixa', () => {
    const r = classificarDocumento(base)
    expect(r).toMatchObject({ categoria: '', confianca: 'baixa' })
  })

  it('empate entre categorias não escolhe nenhuma', () => {
    const r = classificarDocumento({
      ...base,
      titulo: 'Configurar o fluxo',
    })
    expect(r.categoria).toBe('')
  })

  it('texto com código e termos técnicos vira técnico e restrito', () => {
    const r = classificarDocumento({
      titulo: 'Chamando a API',
      caminho: 'api.md',
      texto:
        'Use o endpoint REST com token.\n```json\n{"a":1}\n```\n```sql\nselect 1\n```\nO log do servidor mostra o stack trace.',
    })
    expect(r.conteudo).toBe('tecnico')
    expect(r.publico).toBe('tecnico')
    expect(r.motivos.join(' ')).toContain('bloco(s) de código')
  })

  it('poucos termos técnicos viram misto (restrito) e "catálogo" não conta como "log"', () => {
    const misto = classificarDocumento({
      ...base,
      texto: 'Veja o log do sistema, o json gerado e o token usado.',
    })
    expect(misto.conteudo).toBe('misto')
    expect(misto.publico).toBe('tecnico')
    const funcional = classificarDocumento({
      ...base,
      texto: 'Abra o catálogo de produtos e escolha uma opção.',
    })
    expect(funcional.conteudo).toBe('funcional')
  })
})
