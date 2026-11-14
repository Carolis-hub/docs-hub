import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { AppUser } from '../types/user'
import { mesmosIds, produtosDasUnidades } from '../utils/acessoPorUnidade'
import { registrarAuditoria } from './audit'
import { db } from './firebase'

/**
 * Refaz `produtosPermitidos` de quem tem acesso por BU. Roda depois que um
 * produto é criado ou muda de BU: as regras do Firestore leem a lista de
 * produtos, então ela precisa acompanhar o que há em cada BU. Devolve quantas
 * contas mudaram.
 */
export async function recalcularAcessosPorUnidade(
  adminUid: string,
): Promise<number> {
  const [usuarios, raiz, unidades] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(query(collection(db, 'blocks'), where('parentId', '==', null))),
    getDocs(collection(db, 'unidades')),
  ])
  const produtos = raiz.docs.map((d) => ({
    id: d.id,
    unidadeId: (d.data() as { unidadeId?: string | null }).unidadeId,
  }))
  const idsDasUnidades = unidades.docs.map((d) => d.id)

  const batch = writeBatch(db)
  let alterados = 0
  for (const d of usuarios.docs) {
    const u = d.data() as Omit<AppUser, 'uid'>
    if (u.role === 'admin' || !Array.isArray(u.unidadesPermitidas)) continue
    const novos = produtosDasUnidades(
      u.unidadesPermitidas,
      produtos,
      idsDasUnidades,
    )
    if (mesmosIds(u.produtosPermitidos, novos)) continue
    batch.update(d.ref, { produtosPermitidos: novos })
    registrarAuditoria(
      batch,
      adminUid,
      'usuario.editar',
      `users/${d.id}`,
      'acesso recalculado pela BU',
    )
    alterados++
  }
  if (alterados > 0) await batch.commit()
  return alterados
}
