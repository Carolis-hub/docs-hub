import { useAuth } from './useAuth'
import { useAsync } from './useAsync'
import { listProducts } from '../services/blocks'
import { listUnidades } from '../services/unidades'
import { carregarMotor } from '../services/search'

/** Produtos acessíveis e o motor de busca da sessão (carregado uma vez). */
export function useSearchEngine() {
  const { profile, isAdmin } = useAuth()
  const permitidos = profile?.produtosPermitidos.join(',') ?? ''
  return useAsync(async () => {
    if (!profile) return null
    const produtos = await listProducts(
      isAdmin ? undefined : profile.produtosPermitidos,
    )
    const [motor, unidades] = await Promise.all([
      carregarMotor({
        productIds: produtos.map((p) => p.id),
        verTecnico: isAdmin || profile.verTecnico,
      }),
      // As unidades só ajudam a filtrar: se não carregarem, a busca segue sem elas.
      listUnidades().catch(() => []),
    ])
    return { produtos, unidades, motor }
  }, [profile?.uid, isAdmin, permitidos, profile?.verTecnico])
}
