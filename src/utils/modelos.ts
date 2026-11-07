import type { JSONContent } from '@tiptap/react'
import type { ArticlePublico, CategoriaId } from '../types/content'
import { EMPTY_DOC } from './content'

/** Estrutura sugerida para um tipo de documento, já com a categoria e o público. */
export interface ModeloDocumento {
  id: string
  nome: string
  descricao: string
  categoria: CategoriaId | ''
  publico: ArticlePublico
  conteudo: JSONContent
}

/** Trecho do modelo que ainda precisa ser escrito: `[Preencher: …]`. */
const TRECHO = /\[Preencher:[^\]]*\]/g

const texto = (t: string): JSONContent => ({ type: 'text', text: t })
const par = (t: string): JSONContent => ({
  type: 'paragraph',
  content: [texto(t)],
})
const titulo = (t: string): JSONContent => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [texto(t)],
})
const lista = (itens: string[], ordenada = false): JSONContent => ({
  type: ordenada ? 'orderedList' : 'bulletList',
  ...(ordenada ? { attrs: { start: 1 } } : {}),
  content: itens.map((i) => ({ type: 'listItem', content: [par(i)] })),
})
const celula = (tipo: 'tableHeader' | 'tableCell', t: string): JSONContent => ({
  type: tipo,
  attrs: { colspan: 1, rowspan: 1, colwidth: null },
  content: [par(t)],
})
const tabela = (cabecalho: string[], linhas: string[][]): JSONContent => ({
  type: 'table',
  content: [
    {
      type: 'tableRow',
      content: cabecalho.map((c) => celula('tableHeader', c)),
    },
    ...linhas.map((l) => ({
      type: 'tableRow',
      content: l.map((c) => celula('tableCell', c)),
    })),
  ],
})
const doc = (...content: JSONContent[]): JSONContent => ({
  type: 'doc',
  content,
})

export const MODELOS: ModeloDocumento[] = [
  {
    id: 'em-branco',
    nome: 'Em branco',
    descricao: 'Começa vazio, sem estrutura nem categoria.',
    categoria: '',
    publico: 'usuario',
    conteudo: EMPTY_DOC,
  },
  {
    id: 'funcionalidade',
    nome: 'Funcionalidade',
    descricao: 'Explica o que uma tela ou recurso faz e como usá-lo.',
    categoria: 'funcionalidades',
    publico: 'usuario',
    conteudo: doc(
      titulo('Para que serve'),
      par(
        '[Preencher: explique em uma ou duas frases o que a funcionalidade permite fazer e para quem ela é útil.]',
      ),
      titulo('Onde encontrar'),
      par(
        '[Preencher: caminho no sistema, por exemplo Menu > Cadastros > Clientes.]',
      ),
      titulo('Como usar'),
      lista(
        ['[Preencher: primeiro passo.]', '[Preencher: segundo passo.]'],
        true,
      ),
      titulo('Campos e opções'),
      tabela(
        ['Campo', 'Descrição'],
        [['[Preencher: nome do campo]', '[Preencher: o que ele faz]']],
      ),
      titulo('Observações'),
      par(
        '[Preencher: limitações, permissões necessárias e dicas. Apague esta seção se não houver.]',
      ),
    ),
  },
  {
    id: 'configuracao',
    nome: 'Configuração',
    descricao: 'Ensina a ligar, ajustar ou parametrizar algo no sistema.',
    categoria: 'configuracoes',
    publico: 'usuario',
    conteudo: doc(
      titulo('O que esta configuração controla'),
      par('[Preencher: o efeito da configuração no uso do sistema.]'),
      titulo('Antes de começar'),
      lista([
        '[Preencher: permissão ou perfil necessário.]',
        '[Preencher: o que precisa estar pronto antes.]',
      ]),
      titulo('Passo a passo'),
      lista(
        ['[Preencher: primeiro passo.]', '[Preencher: segundo passo.]'],
        true,
      ),
      titulo('Parâmetros'),
      tabela(
        ['Parâmetro', 'Valor padrão', 'Descrição'],
        [
          [
            '[Preencher: nome]',
            '[Preencher: valor padrão]',
            '[Preencher: o que muda]',
          ],
        ],
      ),
      titulo('Como conferir se funcionou'),
      par('[Preencher: o que a pessoa deve ver ou testar.]'),
      titulo('Problemas comuns'),
      lista(['[Preencher: sintoma e como resolver.]']),
    ),
  },
  {
    id: 'processo',
    nome: 'Processo / passo a passo',
    descricao: 'Descreve um fluxo de trabalho do começo ao fim.',
    categoria: 'processos',
    publico: 'usuario',
    conteudo: doc(
      titulo('Objetivo'),
      par('[Preencher: o que se alcança ao concluir o processo.]'),
      titulo('Quando usar'),
      par('[Preencher: a situação em que este processo se aplica.]'),
      titulo('Quem participa'),
      tabela(
        ['Papel', 'Responsabilidade'],
        [['[Preencher: quem]', '[Preencher: o que faz no processo]']],
      ),
      titulo('Etapas'),
      lista(
        [
          '[Preencher: primeira etapa.]',
          '[Preencher: segunda etapa.]',
          '[Preencher: terceira etapa.]',
        ],
        true,
      ),
      titulo('Resultado esperado'),
      par('[Preencher: como saber que o processo terminou bem.]'),
      titulo('Pontos de atenção'),
      lista(['[Preencher: erro comum ou cuidado importante.]']),
    ),
  },
  {
    id: 'regra-de-negocio',
    nome: 'Regra de negócio',
    descricao: 'Registra uma regra, seus limites e exemplos.',
    categoria: 'regras-de-negocio',
    publico: 'usuario',
    conteudo: doc(
      titulo('Regra'),
      par(
        '[Preencher: enuncie a regra de forma direta, em uma ou duas frases.]',
      ),
      titulo('Quando se aplica'),
      par('[Preencher: em que situações, produtos ou perfis a regra vale.]'),
      titulo('Exceções'),
      lista([
        '[Preencher: caso em que a regra não vale. Apague se não houver.]',
      ]),
      titulo('Exemplos'),
      tabela(
        ['Situação', 'Resultado'],
        [['[Preencher: exemplo]', '[Preencher: o que o sistema faz]']],
      ),
      titulo('Funcionalidades relacionadas'),
      par('[Preencher: telas ou artigos ligados a esta regra.]'),
    ),
  },
]

export const modeloPorId = (id: string | null | undefined) =>
  MODELOS.find((m) => m.id === id)

function textoDe(no: JSONContent, saida: string[]) {
  if (no.type === 'text') saida.push(no.text ?? '')
  else no.content?.forEach((f) => textoDe(f, saida))
  if (no.type === 'paragraph' || no.type === 'heading') saida.push('\n')
}

/** Quantos trechos `[Preencher: …]` do modelo ainda estão no documento. */
export function trechosParaPreencher(conteudo: JSONContent): number {
  const partes: string[] = []
  textoDe(conteudo, partes)
  return (partes.join('').match(TRECHO) ?? []).length
}

export const mensagemTrechos = (n: number) =>
  `Ainda ${n === 1 ? 'há 1 trecho' : `há ${n} trechos`} do modelo para preencher (marcados como "[Preencher: …]"). Escreva o conteúdo ou apague ${n === 1 ? 'o trecho' : 'os trechos'} antes de continuar.`
