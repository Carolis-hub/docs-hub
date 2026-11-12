/** Endereço do artigo; com `secao`, a tela do artigo rola até aquele título. */
export function linkDoArtigo(id: string, secao?: string): string {
  return secao ? `/a/${id}?secao=${encodeURIComponent(secao)}` : `/a/${id}`
}
