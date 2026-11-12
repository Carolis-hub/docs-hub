import { normalizar } from './search.ts'

export const MAX_GRUPOS_SINONIMOS = 200
const MAX_TERMOS = 12
const MAX_TERMO = 40

/**
 * Sinônimos da busca de um produto. Cada linha é um grupo de termos que, na
 * documentação daquele produto, querem dizer a mesma coisa, separados por
 * vírgula: `excluir, apagar, remover`. Ficam no documento do produto
 * (`blocks/{id}.sinonimos`), que a busca já lê, então não custam leitura a mais.
 */
export function limparSinonimos(linhas: readonly string[]): string[] {
  const saida: string[] = []
  for (const linha of linhas) {
    const termos = [
      ...new Set(
        linha
          .split(/[,;]/)
          .map((t) => t.replace(/\s+/g, ' ').trim().slice(0, MAX_TERMO))
          .filter(Boolean),
      ),
    ].slice(0, MAX_TERMOS)
    // Um termo sozinho não é sinônimo de nada.
    if (termos.length >= 2) saida.push(termos.join(', '))
    if (saida.length >= MAX_GRUPOS_SINONIMOS) break
  }
  return saida
}

/** Grupos prontos para a busca: minúsculas, sem acento. */
export function gruposDeSinonimos(
  linhas: readonly string[] | undefined,
): string[][] {
  return limparSinonimos(linhas ?? []).map((linha) =>
    linha.split(', ').map(normalizar),
  )
}
