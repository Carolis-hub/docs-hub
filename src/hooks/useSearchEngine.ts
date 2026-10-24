import { useAuth } from './useAuth'
import { useAsync } from './useAsync'
import { listProducts } from '../services/blocks'
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
    const motor = await carregarMotor({
      productIds: produtos.map((p) => p.id),
      verTecnico: isAdmin || profile.verTecnico,
    })
    return { produtos, motor }
  }, [profile?.uid, isAdmin, permitidos, profile?.verTecnico])
}
