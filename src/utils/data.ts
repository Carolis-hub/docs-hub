/** Formata uma data como AAAA-MM-DD (fuso local), usado como chave de viewsDaily. */
export function formatarDataChave(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/** Quantos meses se passaram desde `dataEm` (timestamp em ms) até agora. */
export function mesesDesde(dataEm: number, agora = Date.now()): number {
  const diffMs = agora - dataEm
  const mediaDiasPorMes = 30.44
  return diffMs / (1000 * 60 * 60 * 24 * mediaDiasPorMes)
}
