import { useState, type FormEvent } from 'react'
import { Building2, Plus, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { BlockCards } from '../components/BlockCards'
import { BlockForm } from '../components/BlockForm'
import { TituloDeSecao } from '../components/ListToolbar'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../hooks/useAuth'
import { createBlock, deleteBlock, updateBlock } from '../services/blocks'
import { carregarVisaoGeral } from '../services/visaoGeral'
import type { Block, Unidade } from '../types/content'
import { pluralizar, resumirUnidade } from '../utils/resumoUnidade'
import { agruparPorUnidade } from '../utils/unidades'
import { Carregando } from '../components/Carregando'

function CartaoUnidade({
  unidade,
  produtos,
  artigos,
}: {
  unidade: Unidade
  produtos: Block[]
  artigos: Record<string, number>
}) {
  const resumo = resumirUnidade(produtos, artigos)
  return (
    <Link
      to={`/u/${unidade.id}`}
      className="cartao flex min-h-[210px] flex-col gap-3.5 p-5 transition hover:border-destaque/50"
    >
      <span className="tile size-11 text-xl" aria-hidden>
        {unidade.icone ? unidade.icone : <Building2 className="size-5" />}
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-[17px] font-bold">{unidade.nome}</span>
        {unidade.descricao && (
          <span className="text-sm leading-relaxed text-suave">
            {unidade.descricao}
          </span>
        )}
      </span>
      <span className="mt-auto flex gap-5 border-t border-borda pt-3.5 text-[13px] text-suave">
        <span>
          <strong className="text-[15px] text-texto">{resumo.produtos}</strong>{' '}
          {resumo.produtos === 1 ? 'produto' : 'produtos'}
        </span>
        <span>
          <strong className="text-[15px] text-texto">{resumo.artigos}</strong>{' '}
          {resumo.artigos === 1 ? 'artigo' : 'artigos'}
        </span>
      </span>
    </Link>
  )
}

export function Home() {
  const { user, profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const uid = user?.uid ?? ''
  const { dados, erro, carregando, recarregar } = useAsync(
    () =>
      carregarVisaoGeral(
        isAdmin ? undefined : (profile?.produtosPermitidos ?? []),
        isAdmin || profile?.verTecnico === true,
      ),
    [isAdmin, profile?.uid],
  )
  const [texto, setTexto] = useState('')
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<Block | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const produtos = dados?.produtos ?? []
  const unidades = dados?.unidades ?? []
  const subprodutos = dados?.subprodutos ?? {}
  const artigos = dados?.artigos ?? {}
  const grupos = agruparPorUnidade(produtos, unidades, isAdmin)
  const unidadesComProdutos = grupos.filter((g) => g.unidade)
  const soltos = grupos.find((g) => !g.unidade)?.produtos ?? []
  const resumos: Record<string, string> = {}
  for (const p of produtos) {
    resumos[p.id] =
      `${pluralizar(subprodutos[p.id]?.length ?? 0, 'subproduto', 'subprodutos')} · ${pluralizar(artigos[p.id] ?? 0, 'artigo', 'artigos')}`
  }

  function buscar(e: FormEvent) {
    e.preventDefault()
    navigate(
      texto.trim() ? `/busca?q=${encodeURIComponent(texto.trim())}` : '/busca',
    )
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
    <div className="space-y-12">
      <section className="pt-4 text-center">
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Encontre a{' '}
          <span className="bg-gradient-to-r from-destaque to-[#1FAE6E] bg-clip-text text-transparent">
            documentação
          </span>{' '}
          de que você precisa
        </h1>
        <form
          role="search"
          onSubmit={buscar}
          className="mx-auto mt-8 flex max-w-3xl items-center gap-2.5 rounded-full border border-borda bg-cartao py-1.5 pl-5 pr-1.5 shadow-[0_10px_30px_rgb(18_53_43_/_0.07)]"
        >
          <Search className="size-5 shrink-0 text-suave" aria-hidden />
          <label htmlFor="home-q" className="sr-only">
            Pesquisar artigos
          </label>
          <input
            id="home-q"
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Pesquise por funcionalidade, erro ou palavra-chave"
            className="h-11 min-w-0 flex-1 bg-transparent text-base text-texto outline-none placeholder:text-suave"
          />
          <button type="submit" className="botao botao-primario h-11 px-6">
            Buscar
          </button>
        </form>
      </section>

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
        <p role="alert" className="text-sm text-perigo">
          {aviso}
        </p>
      )}
      {carregando && <Carregando />}
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

      {(unidades.length > 0 || isAdmin) && (
        <section aria-label="Unidades de negócio" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TituloDeSecao
              titulo="Unidades de negócio"
              total={unidadesComProdutos.length}
            />
            {isAdmin && (
              <div className="flex flex-wrap gap-2">
                <Link to="/admin/unidades" className="botao">
                  <Plus className="size-4" aria-hidden />
                  Nova BU
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
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {unidadesComProdutos.map((g) => (
              <CartaoUnidade
                key={g.chave}
                unidade={g.unidade as Unidade}
                produtos={g.produtos}
                artigos={artigos}
              />
            ))}
            {isAdmin && (
              <Link
                to="/admin/unidades"
                className="flex min-h-[210px] flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-borda text-sm font-semibold text-suave transition hover:border-destaque/60 hover:text-texto"
              >
                <Plus className="size-5" aria-hidden />
                Criar unidade de negócio
              </Link>
            )}
          </div>
        </section>
      )}

      {(unidades.length === 0 || soltos.length > 0) && produtos.length > 0 && (
        <section aria-label="Produtos" className="space-y-4">
          {unidades.length > 0 && (
            <TituloDeSecao titulo="Sem unidade" total={soltos.length} />
          )}
          <BlockCards
            blocos={unidades.length === 0 ? produtos : soltos}
            variante="produto"
            editavel={isAdmin}
            subprodutos={subprodutos}
            resumos={resumos}
            onEdit={setEditando}
            onDelete={(b) => void excluir(b)}
          />
        </section>
      )}

      <section className="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-3xl bg-gradient-to-r from-[#0B5E3B] via-[#0F7A4C] to-[#0C6A43] px-10 py-8 text-white">
        <h2 className="min-w-[280px] flex-1 text-[28px] font-extrabold leading-tight tracking-tight">
          Toda a documentação em um só lugar.
          <span className="block text-[#F7A25E]">
            Atualizada por quem conhece o produto.
          </span>
        </h2>
        <p className="min-w-[280px] flex-1 text-[15.5px] leading-relaxed text-white/90">
          Busque por palavra-chave, navegue pela estrutura de BUs, produtos e
          módulos, e conte com o assistente de IA para encontrar respostas com
          as fontes indicadas.
        </p>
      </section>
    </div>
  )
}
