/**
 * Produto em que uma consulta roda. Vale o pedido (ex.: `?produto=` na URL);
 * sem ele, o produto em contexto; sem os dois, o único produto da pessoa, se
 * ela só tiver um. Um produto que a pessoa não pode ver nunca é devolvido.
 * `''` significa que ela ainda precisa escolher.
 */
export function produtoDaConsulta(
  pedido: string | undefined,
  contexto: string,
  produtos: readonly { id: string }[],
): string {
  const permitido = (id: string | undefined) =>
    !!id && produtos.some((p) => p.id === id)
  if (pedido) return permitido(pedido) ? pedido : ''
  if (permitido(contexto)) return contexto
  return produtos.length === 1 ? produtos[0]!.id : ''
}
