import type { ArticleStatus, RevisaoStatus } from '../types/content'

/**
 * Ciclo de vida de um documento (regras da Fase 4).
 *
 *   rascunho → em revisão → aprovado → publicado
 *                  ↓            ↓          ↓
 *              reprovado    (reabrir)   arquivado
 *
 * Só um documento APROVADO pode ser publicado. Um artigo já publicado não é
 * editado no lugar: as mudanças vão para uma revisão pendente, que segue o
 * mesmo caminho (rascunho → revisão → aprovada) e, ao ser publicada, vira a
 * nova versão. Enquanto isso a versão publicada continua no ar.
 */
export type EstadoCiclo = ArticleStatus
export type AcaoCiclo =
  | 'enviar'
  | 'aprovar'
  | 'reprovar'
  | 'reabrir'
  | 'publicar'
  | 'despublicar'
  | 'arquivar'
  | 'restaurar'

const TRANSICOES: Record<
  AcaoCiclo,
  { de: EstadoCiclo[]; para: EstadoCiclo; rotulo: string }
> = {
  enviar: {
    de: ['draft', 'rejected'],
    para: 'review',
    rotulo: 'Enviar para revisão',
  },
  aprovar: { de: ['review'], para: 'approved', rotulo: 'Aprovar' },
  reprovar: {
    de: ['review'],
    para: 'rejected',
    rotulo: 'Reprovar (pedir ajustes)',
  },
  reabrir: {
    de: ['review', 'approved', 'rejected'],
    para: 'draft',
    rotulo: 'Voltar a rascunho',
  },
  publicar: { de: ['approved'], para: 'published', rotulo: 'Publicar' },
  despublicar: { de: ['published'], para: 'draft', rotulo: 'Despublicar' },
  arquivar: {
    de: ['published', 'draft'],
    para: 'archived',
    rotulo: 'Arquivar',
  },
  restaurar: {
    de: ['archived'],
    para: 'draft',
    rotulo: 'Restaurar como rascunho',
  },
}

/** Ordem em que os botões aparecem. */
const ORDEM: AcaoCiclo[] = [
  'enviar',
  'aprovar',
  'publicar',
  'reprovar',
  'reabrir',
  'despublicar',
  'arquivar',
  'restaurar',
]

/** Ações que só fazem sentido para o artigo em si, não para uma alteração pendente. */
const SO_DO_ARTIGO: AcaoCiclo[] = ['despublicar', 'arquivar', 'restaurar']

export function rotuloDaAcao(acao: AcaoCiclo): string {
  return TRANSICOES[acao].rotulo
}

/** Estado para o qual a ação leva, ou `null` se ela não vale a partir de `estado`. */
export function proximoEstado(
  estado: EstadoCiclo,
  acao: AcaoCiclo,
): EstadoCiclo | null {
  const t = TRANSICOES[acao]
  return t.de.includes(estado) ? t.para : null
}

/** Ações possíveis a partir de um estado, na ordem de exibição. */
export function acoesDisponiveis(
  estado: EstadoCiclo,
  opcoes: { revisao?: boolean } = {},
): AcaoCiclo[] {
  return ORDEM.filter(
    (a) =>
      proximoEstado(estado, a) !== null &&
      !(opcoes.revisao && SO_DO_ARTIGO.includes(a)),
  )
}

/** Reprovar é um pedido de ajustes: sem dizer o que ajustar, não vale. */
export function exigeComentario(acao: AcaoCiclo): boolean {
  return acao === 'reprovar'
}

export const ROTULOS_STATUS: Record<EstadoCiclo, string> = {
  draft: 'Rascunho',
  review: 'Em revisão',
  approved: 'Aprovado',
  published: 'Publicado',
  rejected: 'Reprovado',
  archived: 'Arquivado',
}

export const ehRevisaoStatus = (s: string): s is RevisaoStatus =>
  ['draft', 'review', 'approved', 'rejected'].includes(s)
