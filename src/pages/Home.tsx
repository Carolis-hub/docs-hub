import { useState } from 'react'
import { Building2, Layers, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BlockCards } from '../components/BlockCards'
import { BlockForm } from '../components/BlockForm'
import { Interruptor, TituloDeSecao } from '../components/ListToolbar'
import { PageHeader } from '../components/PageHeader'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../hooks/useAuth'
import {
  createBlock,
  deleteBlock,
  listChildren,
  listProducts,
  reorderBlocks,
  updateBlock,
} from '../services/blocks'
import { listUnidades } from '../services/unidades'
import type { Block } from '../types/content'
import { agruparPorUnidade } from '../utils/unidades'

export function Home() {
  const { user, profile, isAdmin } = useAuth()
  const uid = user?.uid ?? ''
  const { dados, erro, carregando, recarregar } = useAsync(async () => {
    const [produtos, unidades] = await Promise.all([
      listProducts(isAdmin ? undefined : (profile?.produtosPermitidos ?? [])),
      listUnidades(),
    ])
    // Subprodutos de cada produto (a consulta leva o productId por causa das regras).
    const filhos = await Promise.all(
      produtos.map((p) => listChildren(p.id, p.id)),
    )
    const subprodutos: Record<string, Block[]> = {}
    produtos.forEach((p, i) => {
      subprodutos[p.id] = filhos[i] ?? []
    })
    return { produtos, unidades, subprodutos }
  }, [isAdmin, profile?.uid])
  const [criando, setCriando] = useState(false)
  const [organizar, setOrganizar] = useState(false)
  const [editando, setEditando] = useState<Block | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const produtos = dados?.produtos ?? []
  const unidades = dados?.unidades ?? []
  const subprodutos = dados?.subprodutos ?? {}
  const grupos = agruparPorUnidade(produtos, unidades, isAdmin)

  async function reordenar(ordenados: Block[]) {
    await reorderBlocks(ordenados.map((b) => b.id))
    recarregar()
  }

  async function excluir(b: Block) {
    if (!window.confirm(`Excluir o produto "${b.nome}"?`)) return
    try {
      await deleteBlock(b.id, uid)
      setAviso(null)
      recarregar()
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível excluir.')
    }
  }

  return (
    <div>
      <PageHeader
        icone={Layers}
        titulo="Manual de produtos"
        subtitulo={
          produtos.length > 0
            ? `${produtos.length} ${produtos.length === 1 ? 'produto' : 'produtos'} de documentação`
            : undefined
        }
        acoes={
          isAdmin && (
            <>
              {produtos.length > 1 && (
                <Interruptor
                  ligado={organizar}
                  aoMudar={setOrganizar}
                  rotulo="Organizar"
                />
              )}
              <Link to="/admin/unidades" className="botao">
                <Building2 className="size-4" aria-hidden />
                Unidades de negócio
              </Link>
              {!criando && (
                <button
                  type="button"
                  onClick={() => setCriando(true)}
                  className="botao botao-primario"
                >
                  <Plus className="size-4" aria-hidden />
                  Novo produto
                </button>
              )}
            </>
          )
        }
      />

      {criando && (
        <BlockForm
          titulo="Novo produto"
          unidades={unidades}
          onCancel={() => setCriando(false)}
          onSubmit={async (input) => {
            await createBlock(input, null, produtos.length, uid)
            setCriando(false)
            recarregar()
          }}
        />
      )}
      {editando && (
        <BlockForm
          titulo="Editar produto"
          unidades={unidades}
          inicial={editando}
          onCancel={() => setEditando(null)}
          onSubmit={async (input) => {
            await updateBlock(editando.id, input, uid)
            setEditando(null)
            recarregar()
          }}
        />
      )}
      {aviso && (
        <p role="alert" className="mb-4 text-sm text-perigo">
          {aviso}
        </p>
      )}

      {carregando && <p className="text-suave">Carregando…</p>}
      {erro && (
        <p role="alert" className="text-perigo">
          {erro}
        </p>
      )}
      {!carregando && !erro && produtos.length === 0 && (
        <p className="text-suave">
          {isAdmin
            ? 'Nenhum produto ainda. Crie o primeiro em "Novo produto".'
            : 'Você ainda não tem acesso a nenhum produto. Fale com um administrador.'}
        </p>
      )}
      {unidades.length === 0 && produtos.length > 0 && (
        <BlockCards
          blocos={produtos}
          variante="produto"
          subprodutos={subprodutos}
          editavel={isAdmin}
          organizar={isAdmin && organizar}
          onReorder={isAdmin ? (o) => void reordenar(o) : undefined}
          onEdit={setEditando}
          onDelete={(b) => void excluir(b)}
        />
      )}
      {unidades.length > 0 &&
        grupos.map((g) => (
          <section
            key={g.chave}
            id={g.unidade ? `unidade-${g.unidade.id}` : undefined}
            aria-label={g.unidade?.nome ?? 'Sem unidade'}
            className="mb-10 scroll-mt-4"
          >
            <div className="mb-4">
              <TituloDeSecao
                titulo={g.unidade?.nome ?? 'Sem unidade'}
                total={g.produtos.length}
              />
              {g.unidade?.descricao && (
                <p className="mt-1 text-sm text-suave">{g.unidade.descricao}</p>
              )}
            </div>
            {g.produtos.length === 0 ? (
              <p className="text-sm text-suave">
                Nenhum produto nesta unidade ainda. Edite um produto e escolha
                esta unidade.
              </p>
            ) : (
              <BlockCards
                blocos={g.produtos}
                variante="produto"
                subprodutos={subprodutos}
                editavel={isAdmin}
                organizar={isAdmin && organizar}
                onReorder={isAdmin ? (o) => void reordenar(o) : undefined}
                onEdit={setEditando}
                onDelete={(b) => void excluir(b)}
              />
            )}
          </section>
        ))}
    </div>
  )
}
