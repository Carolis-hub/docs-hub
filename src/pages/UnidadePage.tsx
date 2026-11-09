import { useState } from 'react'
import { Building2, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { BlockCards } from '../components/BlockCards'
import { BlockForm } from '../components/BlockForm'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../hooks/useAuth'
import { createBlock, deleteBlock, updateBlock } from '../services/blocks'
import { carregarVisaoGeral } from '../services/visaoGeral'
import type { Block } from '../types/content'
import { pluralizar, resumirUnidade } from '../utils/resumoUnidade'
import { Carregando } from '../components/Carregando'

export function UnidadePage() {
  const { unidadeId = '' } = useParams()
  const { user, profile, isAdmin } = useAuth()
  const uid = user?.uid ?? ''
  const { dados, erro, carregando, recarregar } = useAsync(
    () =>
      carregarVisaoGeral(
        isAdmin ? undefined : (profile?.produtosPermitidos ?? []),
        isAdmin || profile?.verTecnico === true,
      ),
    [isAdmin, profile?.uid, unidadeId],
  )
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<Block | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const unidade = dados?.unidades.find((u) => u.id === unidadeId)
  const produtos = (dados?.produtos ?? []).filter(
    (p) => p.unidadeId === unidadeId,
  )
  const subprodutos = dados?.subprodutos ?? {}
  const artigos = dados?.artigos ?? {}
  const resumo = resumirUnidade(produtos, artigos)
  const resumos: Record<string, string> = {}
  for (const p of produtos) {
    resumos[p.id] =
      `${pluralizar(subprodutos[p.id]?.length ?? 0, 'subproduto', 'subprodutos')} · ${pluralizar(artigos[p.id] ?? 0, 'artigo', 'artigos')}`
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

  if (carregando) return <Carregando />
  if (erro) {
    return (
      <p role="alert" className="text-perigo">
        {erro}
      </p>
    )
  }
  if (!unidade) {
    return (
      <p className="text-suave">
        Unidade de negócio não encontrada.{' '}
        <Link to="/" className="text-destaque underline">
          Voltar ao manual de produtos
        </Link>
      </p>
    )
  }

  return (
    <div>
      <nav
        aria-label="Navegação estrutural"
        className="mb-5 text-sm text-suave"
      >
        <Link to="/" className="hover:text-texto hover:underline">
          Manual de produtos
        </Link>
        <span aria-hidden> › </span>
        <span aria-current="page" className="font-semibold text-texto">
          {unidade.nome}
        </span>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-borda pb-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="tile size-11 text-xl" aria-hidden>
            {unidade.icone ? unidade.icone : <Building2 className="size-5" />}
          </span>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-destaque">BU</span>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">
                {unidade.nome}
              </h1>
              <span className="text-[13px] text-suave">
                <strong className="text-texto">{resumo.produtos}</strong>{' '}
                {resumo.produtos === 1 ? 'produto' : 'produtos'}
              </span>
              <span className="text-[13px] text-suave">
                <strong className="text-texto">{resumo.artigos}</strong>{' '}
                {resumo.artigos === 1
                  ? 'artigo publicado'
                  : 'artigos publicados'}
              </span>
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/unidades" className="botao">
              Editar
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
          </div>
        )}
      </header>

      {unidade.descricao && (
        <p className="mt-4 text-sm text-suave">{unidade.descricao}</p>
      )}

      <div className="mt-6">
        {criando && (
          <BlockForm
            titulo="Novo produto"
            unidades={dados?.unidades}
            inicial={{
              nome: '',
              descricao: '',
              icone: '',
              unidadeId: unidade.id,
            }}
            onCancel={() => setCriando(false)}
            onSubmit={async (input) => {
              await createBlock(input, null, dados?.produtos.length ?? 0, uid)
              setCriando(false)
              recarregar()
            }}
          />
        )}
        {editando && (
          <BlockForm
            titulo="Editar produto"
            unidades={dados?.unidades}
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
        {produtos.length === 0 ? (
          <p className="text-sm text-suave">
            Nenhum produto nesta unidade ainda.
          </p>
        ) : (
          <BlockCards
            blocos={produtos}
            variante="produto"
            editavel={isAdmin}
            subprodutos={subprodutos}
            resumos={resumos}
            onEdit={setEditando}
            onDelete={(b) => void excluir(b)}
          />
        )}
      </div>
    </div>
  )
}
