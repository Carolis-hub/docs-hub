/** Iniciais para o avatar: duas letras do nome (ou do e-mail). */
export function iniciais(
  nome: string | undefined,
  email: string | null | undefined,
): string {
  const fonte = (nome?.trim() || email?.split('@')[0] || '?').replace(
    /[^\p{L}\p{N} ]/gu,
    ' ',
  )
  const partes = fonte.split(/\s+/).filter(Boolean)
  const letras =
    partes.length > 1
      ? (partes[0]?.[0] ?? '') + (partes[partes.length - 1]?.[0] ?? '')
      : fonte.slice(0, 2)
  return letras.trim().toUpperCase() || '?'
}
