/** Remove acentos e normaliza para minúsculas, sem alterar espaços/pontuação. */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
