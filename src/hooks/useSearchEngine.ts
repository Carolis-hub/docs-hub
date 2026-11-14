import { useAuth } from './useAuth'
import { useAsync } from './useAsync'
import { useProdutoEmContexto } from './useProdutoEmContexto'
import { listProducts } from '../services/blocks'
import { listUnidades } from '../services/unidades'
import { carregarMotor } from '../services/search'
import { produtoDaConsulta } from '../utils/produtoDaConsulta'
import { gruposDeSinonimos, sinonimosDoProduto } from '../utils/sinonimos'

/**
 * Produtos acessíveis e o motor de busca de **um** produto: o pedido em
 * `produtoPedido` ou, sem ele, o produto em contexto. Só o índice desse
 * produto é baixado. Sem produto definido (`produtoId === ''`), o motor vem
 * vazio e a tela deve pedir a escolha.
 */
export function useSearchEngine(produtoPedido?: string) {
  const { profile, isAdmin } = useAuth()
  const [contexto] = useProdutoEmContexto()
  const permitidos = profile?.produtosPermitidos.join(',') ?? ''
  return useAsync(async () => {
    if (!profile) return null
    const produtos = await listProducts(
      isAdmin ? undefined : profile.produtosPermitidos,
    )
    const produtoId = produtoDaConsulta(produtoPedido, contexto, produtos)
    const [motor, unidades] = await Promise.all([
      carregarMotor({
        productIds: produtoId ? [produtoId] : [],
        verTecnico: isAdmin || profile.verTecnico,
        sinonimos: gruposDeSinonimos(
          sinonimosDoProduto(
            produtos.find((p) => p.id === produtoId)?.sinonimos,
          ),
        ),
      }),
      // As unidades só ajudam a filtrar: se não carregarem, a busca segue sem elas.
      listUnidades().catch(() => []),
    ])
    return { produtos, unidades, motor, produtoId }
  }, [
    profile?.uid,
    isAdmin,
    permitidos,
    profile?.verTecnico,
    produtoPedido,
    contexto,
  ])
}
