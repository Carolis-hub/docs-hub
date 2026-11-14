import type { AppUser } from '../types/user'

/** Chave usada no lugar do id da BU para os produtos que não têm BU. */
export const SEM_UNIDADE = 'sem-unidade'

interface ProdutoComUnidade {
  id: string
  unidadeId?: string | null
}

/** BU do produto, ou `SEM_UNIDADE` quando ele não tem (ou a BU não existe mais). */
function chaveDoProduto(p: ProdutoComUnidade, unidades: string[]): string {
  return p.unidadeId && unidades.includes(p.unidadeId)
    ? p.unidadeId
    : SEM_UNIDADE
}

/**
 * Produtos que a pessoa vê a partir das BUs liberadas para ela. É o que vai
 * para `produtosPermitidos`, o campo que as regras do Firestore leem.
 */
export function produtosDasUnidades(
  liberadas: string[],
  produtos: ProdutoComUnidade[],
  unidades: string[],
): string[] {
  return produtos
    .filter((p) => liberadas.includes(chaveDoProduto(p, unidades)))
    .map((p) => p.id)
    .sort()
}

/**
 * BUs marcadas ao abrir a edição. Conta antiga (só com `produtosPermitidos`)
 * começa com as BUs em que ela já via **todos** os produtos, para que salvar
 * nunca aumente o acesso sem alguém pedir.
 */
export function unidadesIniciais(
  usuario:
    Pick<AppUser, 'unidadesPermitidas' | 'produtosPermitidos'> | undefined,
  produtos: ProdutoComUnidade[],
  unidades: string[],
): string[] {
  if (!usuario) return []
  if (Array.isArray(usuario.unidadesPermitidas)) {
    return usuario.unidadesPermitidas
  }
  const permitidos = new Set(usuario.produtosPermitidos ?? [])
  return [...unidades, SEM_UNIDADE].filter((chave) => {
    const doGrupo = produtos.filter(
      (p) => chaveDoProduto(p, unidades) === chave,
    )
    return doGrupo.length > 0 && doGrupo.every((p) => permitidos.has(p.id))
  })
}

/** As duas listas têm os mesmos ids? (a ordem não importa) */
export function mesmosIds(a: string[] | undefined, b: string[]): boolean {
  const x = [...(a ?? [])].sort()
  const y = [...b].sort()
  return x.length === y.length && x.every((v, i) => v === y[i])
}
