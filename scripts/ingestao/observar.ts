import { createHash } from 'node:crypto'
import { varrer } from './fonte.ts'

/**
 * "Impressão digital" da pasta: caminho, tamanho e data de cada arquivo lido
 * pela ingestão. Se não mudou desde a última conferência, não há o que
 * sincronizar e o Firebase nem é consultado (importa para a cota do Spark).
 */
export async function impressaoDaPasta(pasta: string): Promise<string> {
  const { arquivos } = await varrer(pasta)
  const linhas = arquivos
    .map((a) => `${a.caminho}|${a.tamanho}|${Math.round(a.modificadoEm)}`)
    .sort()
  return createHash('sha1').update(linhas.join('\n')).digest('hex')
}

export interface OpcoesObservar {
  pasta: string
  intervaloMs: number
  /** Roda a ingestão. Se lançar, a pasta é tentada de novo na próxima volta. */
  executar(): Promise<void>
  aoErro?(erro: unknown): void
  /** Chamado a cada volta em que não havia mudança. */
  aoSemMudanca?(): void
  sinal: AbortSignal
  /** Espera entre as voltas; os testes trocam por uma versão rápida. */
  esperar?(ms: number, sinal: AbortSignal): Promise<void>
}

function esperarPadrao(ms: number, sinal: AbortSignal): Promise<void> {
  return new Promise((resolver) => {
    if (sinal.aborted) return resolver()
    const fim = () => {
      clearTimeout(t)
      sinal.removeEventListener('abort', fim)
      resolver()
    }
    const t = setTimeout(fim, ms)
    sinal.addEventListener('abort', fim)
  })
}

/**
 * Vigia a pasta: a cada volta compara a impressão digital e só chama
 * `executar` quando algo mudou (ou na primeira volta). Termina quando o sinal
 * é cancelado. Um erro não derruba a vigília: a mesma mudança é tentada de novo.
 */
export async function observar(opcoes: OpcoesObservar): Promise<void> {
  const esperar = opcoes.esperar ?? esperarPadrao
  let ultima: string | null = null
  while (!opcoes.sinal.aborted) {
    try {
      const agora = await impressaoDaPasta(opcoes.pasta)
      if (agora !== ultima) {
        await opcoes.executar()
        ultima = agora
      } else {
        opcoes.aoSemMudanca?.()
      }
    } catch (e) {
      opcoes.aoErro?.(e)
    }
    await esperar(opcoes.intervaloMs, opcoes.sinal)
  }
}
