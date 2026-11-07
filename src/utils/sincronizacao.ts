import type { Sincronizacao } from '../types/sincronizacao'

/** Depois de quantos dias sem conferir a pasta a fonte aparece como desatualizada. */
export const DIAS_SEM_SINCRONIZAR = 7

export type SituacaoFonte = 'com-erros' | 'desatualizada' | 'em-dia'

/** Erros pesam mais que atraso: um arquivo que não entrou precisa de atenção já. */
export function situacaoDaFonte(
  s: Pick<Sincronizacao, 'ultimaExecucao' | 'erros' | 'resumo'>,
  agora: number,
): SituacaoFonte {
  if (s.erros.length > 0 || (s.resumo.erro ?? 0) > 0) return 'com-erros'
  const dias = (agora - s.ultimaExecucao) / (24 * 3600 * 1000)
  return dias > DIAS_SEM_SINCRONIZAR ? 'desatualizada' : 'em-dia'
}

export const ROTULO_SITUACAO: Record<SituacaoFonte, string> = {
  'com-erros': 'Com erros',
  desatualizada: 'Desatualizada',
  'em-dia': 'Em dia',
}

/** "há 5 min", "há 3 h", "há 2 dias": quanto tempo faz. */
export function haQuantoTempo(ms: number, agora: number): string {
  const seg = Math.max(0, Math.round((agora - ms) / 1000))
  if (seg < 60) return 'agora há pouco'
  const min = Math.round(seg / 60)
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 48) return `há ${h} h`
  return `há ${Math.round(h / 24)} dias`
}

/** Fontes que pedem atenção primeiro (com erros, depois desatualizadas), as outras pela data. */
export function ordenarFontes(
  lista: Sincronizacao[],
  agora: number,
): Sincronizacao[] {
  const peso: Record<SituacaoFonte, number> = {
    'com-erros': 0,
    desatualizada: 1,
    'em-dia': 2,
  }
  return [...lista].sort(
    (a, b) =>
      peso[situacaoDaFonte(a, agora)] - peso[situacaoDaFonte(b, agora)] ||
      b.ultimaExecucao - a.ultimaExecucao,
  )
}
