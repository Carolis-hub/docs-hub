import { useMemo, useState } from 'react'
import { FolderPlus, Layers, Pencil, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ArticleList } from '../components/ArticleList'
import { RodapeDoProduto } from '../components/RodapeDoProduto'
import { BlockCards } from '../components/BlockCards'
import { BlockForm } from '../components/BlockForm'
import { DescricaoDoProduto } from '../components/DescricaoDoProduto'
import { EditorDaFicha } from '../components/EditorDaFicha'
import { FichaDoProduto } from '../components/FichaDoProduto'
import { Breadcrumb } from '../components/Breadcrumb'
import {
  AlternarVisao,
  FiltroDaLista,
  Interruptor,
  TituloDeSecao,
  type Visao,
} from '../components/ListToolbar'
import { PageHeader } from '../components/PageHeader'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../hooks/useAuth'
import { usePreferencia } from '../hooks/usePreferencia'
import {
  createBlock,
  deleteBlock,
  getAncestors,
  getBlock,
  listChildren,
  listProductTree,
  reorderBlocks,
  salvarDescricao,
  salvarFicha,
  updateBlock,
} from '../services/blocks'
import { listArticlesByBlock } from '../services/articles'
import { getUnidade, listUnidades } from '../services/unidades'
import { contarArtigosPorBlocos } from '../services/visaoGeral'
import type { Block } from '../types/content'
import {
  comDescendentes,
  ordemCompleta,
  tipoDoNivel,
  tipoDosFilhos,
} from '../utils/blocos'
import { completarFicha } from '../utils/ficha'
import { iconeDoArtigo } from '../utils/iconeDoArtigo'
import { CATEGORIAS } from '../utils/categorias'
import { normalizar } from '../utils/search'
import { Carregando } from '../components/Carregando'

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`

export function BlockPage() {
  const { blockId = '' } = useParams()
  const { user, profile, isAdmin } = useAuth()
  const uid = user?.uid ?? ''
  const { dados, erro, carregando, recarregar } = useAsync(async () => {
    const bloco = await getBlock(blockId)
    if (!bloco) return null
    const [cadeia, filhos, artigos] = await Promise.all([
      getAncestors(bloco),
      listChildren(blockId, bloco.productId),
      listArticlesByBlock(
        blockId,
        bloco.productId,
        isAdmin ? undefined : { verTecnico: !!profile?.verTecnico },
      ),
    ])
    // Subitens de cada filho (chips do cartão) e artigos publicados dentro de cada um.
    const arvore =
      filhos.length > 0 ? await listProductTree(bloco.productId) : []
    const netos: Record<string, Block[]> = {}
    const contagens: Record<string, number> = {}
    await Promise.all(
      filhos.map(async (f) => {
        netos[f.id] = arvore.filter((b) => b.parentId === f.id)
        contagens[f.id] = await contarArtigosPorBlocos(
          bloco.productId,
          [...comDescendentes(arvore, f.id)],
          isAdmin || !!profile?.verTecnico,
        )
      }),
    )
    const unidadeId = cadeia[0]?.unidadeId
    const [unidade, unidades] = await Promise.all([
      unidadeId ? getUnidade(unidadeId) : null,
      // O seletor de unidade só aparece para o admin, ao editar um produto.
      isAdmin && bloco.parentId === null ? listUnidades() : [],
    ])
    return {
      bloco,
      cadeia,
      unidade,
      unidades,
      filhos,
      artigos,
      netos,
      contagens,
    }
  }, [blockId, isAdmin])

  const [modo, setModo] = useState<'novo' | 'editar' | null>(null)
  const [editandoFilho, setEditandoFilho] = useState<Block | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [editandoFicha, setEditandoFicha] = useState(false)
  const [organizar, setOrganizar] = useState(false)
  const [filtroSecoes, setFiltroSecoes] = useState('')
  const [filtroArtigos, setFiltroArtigos] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [ordem, setOrdem] = useState<'recentes' | 'acessados' | 'titulo'>(
    'recentes',
  )
  const [visao, setVisao] = usePreferencia<Visao>(
    'docs-hub:visao-artigos',
    'lista',
    ['lista', 'grade'],
  )

  const secoes = useMemo(() => {
    const q = normalizar(filtroSecoes.trim())
    return (dados?.filhos ?? []).filter(
      (b) => !q || normalizar(b.nome).includes(q),
    )
  }, [dados, filtroSecoes])

  const artigos = useMemo(() => {
    const q = normalizar(filtroArtigos.trim())
    const lista = (dados?.artigos ?? []).filter(
      (a) =>
        (!q || normalizar(`${a.titulo} ${a.resumo}`).includes(q)) &&
        (!filtroCategoria || a.categoria === filtroCategoria),
    )
    return [...lista].sort((a, b) => {
      if (ordem === 'recentes') return b.atualizadoEm - a.atualizadoEm
      if (ordem === 'acessados') return (b.views ?? 0) - (a.views ?? 0)
      return a.titulo.localeCompare(b.titulo, 'pt-BR')
    })
  }, [dados, filtroArtigos, filtroCategoria, ordem])

  if (carregando && !dados) return <Carregando />
  if (erro)
    return (
      <p role="alert" className="text-perigo">
        {erro}
      </p>
    )
  if (!dados) return <p>Bloco não encontrado.</p>

  const {
    bloco,
    cadeia,
    unidade,
    unidades,
    filhos,
    artigos: todosArtigos,
    netos,
    contagens,
  } = dados
  const ehProduto = bloco.parentId === null
  const profundidade = cadeia.length - 1
  const tipo = tipoDoNivel(profundidade)
  const tipoFilho = tipoDosFilhos(profundidade)
  const resumos: Record<string, string> = {}
  for (const f of filhos) {
    const sub = netos[f.id]?.length ?? 0
    const n = contagens[f.id] ?? 0
    const partes = [
      sub > 0
        ? plural(
            sub,
            tipoDosFilhos(profundidade + 1).singular.toLowerCase(),
            tipoDosFilhos(profundidade + 1).plural.toLowerCase(),
          )
        : null,
      plural(n, 'artigo', 'artigos'),
    ].filter(Boolean)
    resumos[f.id] = partes.join(' · ')
  }
  const totalArtigos = Object.values(contagens).reduce((a, b) => a + b, 0)
  const categoriasPresentes = CATEGORIAS.map((c) => ({
    ...c,
    total: todosArtigos.filter((a) => a.categoria === c.id).length,
  })).filter((c) => c.total > 0)

  async function excluirFilho(b: Block) {
    if (!window.confirm(`Excluir "${b.nome}"?`)) return
    try {
      await deleteBlock(b.id, uid)
      setAviso(null)
      recarregar()
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível excluir.')
    }
  }

  const subtitulo =
    filhos.length > 0
      ? `${tipo} · ${plural(filhos.length, tipoFilho.singular.toLowerCase(), tipoFilho.plural.toLowerCase())} · ${plural(totalArtigos, 'artigo publicado', 'artigos publicados')}`
      : `${tipo} · ${plural(todosArtigos.length, 'artigo publicado', 'artigos publicados')}`

  return (
    <div>
      <Breadcrumb cadeia={cadeia} unidade={unidade} />
      <PageHeader
        icone={ehProduto ? Layers : iconeDoArtigo(bloco.nome, Layers)}
        emoji={bloco.icone || undefined}
        titulo={bloco.nome}
        subtitulo={subtitulo}
        acoes={
          isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setModo('editar')}
                className="botao"
              >
                <Pencil className="size-4" aria-hidden />
                Editar {tipo.toLowerCase()}
              </button>
              <button
                type="button"
                onClick={() => setModo('novo')}
                className="botao"
              >
                <FolderPlus className="size-4" aria-hidden />
                {tipoFilho.artigoNovo}
              </button>
              <Link
                to={`/admin/artigos/novo?blockId=${bloco.id}`}
                className="botao botao-primario"
              >
                <Plus className="size-4" aria-hidden />
                Novo artigo
              </Link>
            </>
          )
        }
      />

      {modo === 'novo' && (
        <BlockForm
          titulo={tipoFilho.artigoNovo}
          onCancel={() => setModo(null)}
          onSubmit={async (input) => {
            await createBlock(input, bloco, filhos.length, uid)
            setModo(null)
            recarregar()
          }}
        />
      )}
      {modo === 'editar' && (
        <BlockForm
          titulo={`Editar ${tipo.toLowerCase()}`}
          inicial={bloco}
          unidades={ehProduto ? unidades : undefined}
          onCancel={() => setModo(null)}
          onSubmit={async (input) => {
            await updateBlock(bloco.id, input, uid)
            setModo(null)
            recarregar()
          }}
        />
      )}
      {editandoFilho && (
        <BlockForm
          titulo={`Editar ${tipoFilho.singular.toLowerCase()}`}
          inicial={editandoFilho}
          onCancel={() => setEditandoFilho(null)}
          onSubmit={async (input) => {
            await updateBlock(editandoFilho.id, input, uid)
            setEditandoFilho(null)
            recarregar()
          }}
        />
      )}
      {aviso && (
        <p role="alert" className="mb-4 text-sm text-perigo">
          {aviso}
        </p>
      )}

      {ehProduto && (
        <DescricaoDoProduto
          descricao={bloco.descricao}
          editavel={isAdmin}
          aoSalvar={async (texto) => {
            await salvarDescricao(bloco.id, texto, uid)
            recarregar()
          }}
        />
      )}

      {filhos.length > 0 && (
        <section className="mb-10" aria-label={tipoFilho.plural}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <TituloDeSecao titulo={tipoFilho.plural} total={filhos.length} />
            <div className="flex flex-wrap items-center gap-2">
              <FiltroDaLista
                valor={filtroSecoes}
                aoMudar={setFiltroSecoes}
                placeholder={`Filtrar ${tipoFilho.plural.toLowerCase()}…`}
              />
              {isAdmin && filhos.length > 1 && (
                <Interruptor
                  ligado={organizar}
                  aoMudar={setOrganizar}
                  rotulo="Organizar"
                />
              )}
            </div>
          </div>
          <BlockCards
            blocos={secoes}
            subprodutos={netos}
            resumos={resumos}
            editavel={isAdmin}
            organizar={isAdmin && organizar && filtroSecoes.trim() === ''}
            onReorder={async (o) => {
              try {
                await reorderBlocks(ordemCompleta(filhos, o))
                setAviso(null)
                recarregar()
              } catch (e) {
                setAviso(
                  e instanceof Error
                    ? e.message
                    : 'Não foi possível gravar a nova ordem.',
                )
                throw e
              }
            }}
            onEdit={setEditandoFilho}
            onDelete={(b) => void excluirFilho(b)}
            onNovo={isAdmin ? () => setModo('novo') : undefined}
            rotuloNovo={tipoFilho.artigoNovo}
          />
          {organizar && filtroSecoes.trim() !== '' && (
            <p className="mt-2 text-xs text-suave">
              Limpe o filtro para arrastar e reordenar.
            </p>
          )}
        </section>
      )}

      {ehProduto &&
        (() => {
          // As 5 opções são fixas: sempre aparecem, só o conteúdo muda.
          const ficha = completarFicha(bloco.ficha)
          if (editandoFicha) {
            return (
              <div className="mb-10">
                <EditorDaFicha
                  inicial={ficha}
                  aoCancelar={() => setEditandoFicha(false)}
                  aoSalvar={async (nova) => {
                    await salvarFicha(bloco.id, nova, uid)
                    setEditandoFicha(false)
                    recarregar()
                  }}
                />
              </div>
            )
          }
          return (
            <section className="mb-10" aria-label="Informações do produto">
              <FichaDoProduto
                ficha={ficha}
                admin={isAdmin}
                acoes={
                  isAdmin && (
                    <button
                      type="button"
                      className="botao w-full"
                      onClick={() => setEditandoFicha(true)}
                    >
                      <Pencil className="size-4" aria-hidden />
                      Editar informações
                    </button>
                  )
                }
              />
            </section>
          )
        })()}

      {(todosArtigos.length > 0 || !ehProduto) && (
        <section aria-label="Artigos">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <TituloDeSecao titulo="Artigos" total={todosArtigos.length} />
            <div className="flex flex-wrap items-center gap-2">
              <FiltroDaLista
                valor={filtroArtigos}
                aoMudar={setFiltroArtigos}
                placeholder="Filtrar neste bloco…"
              />
              <label className="flex items-center gap-2 text-sm text-suave">
                Ordenar
                <select
                  className="campo w-auto"
                  value={ordem}
                  onChange={(e) =>
                    setOrdem(
                      e.target.value as 'recentes' | 'acessados' | 'titulo',
                    )
                  }
                >
                  <option value="recentes">Mais recentes</option>
                  <option value="acessados">Mais acessados</option>
                  <option value="titulo">Título (A a Z)</option>
                </select>
              </label>
              <AlternarVisao visao={visao} aoMudar={setVisao} />
            </div>
          </div>
          {categoriasPresentes.length > 0 && (
            <div
              role="group"
              aria-label="Filtrar por categoria"
              className="mb-4 flex flex-wrap gap-2"
            >
              <button
                type="button"
                aria-pressed={filtroCategoria === ''}
                onClick={() => setFiltroCategoria('')}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${filtroCategoria === '' ? 'border-escuro bg-escuro text-white' : 'border-borda bg-cartao text-suave hover:text-texto'}`}
              >
                Todos ({todosArtigos.length})
              </button>
              {categoriasPresentes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={filtroCategoria === c.id}
                  onClick={() => setFiltroCategoria(c.id)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium ${filtroCategoria === c.id ? 'border-escuro bg-escuro text-white' : 'border-borda bg-cartao text-suave hover:text-texto'}`}
                >
                  {c.nome} ({c.total})
                </button>
              ))}
            </div>
          )}
          {todosArtigos.length === 0 ? (
            <p className="text-suave">Nenhum artigo neste bloco.</p>
          ) : artigos.length === 0 ? (
            <p className="text-suave">Nenhum artigo corresponde aos filtros.</p>
          ) : (
            <ArticleList artigos={artigos} visao={visao} admin={isAdmin} />
          )}
        </section>
      )}
      {/* A configuração do rodapé fica no próprio rodapé (admin, na página do produto). */}
      <RodapeDoProduto
        produto={cadeia[0]}
        configuracao={
          isAdmin && ehProduto ? { uid, aoSalvar: recarregar } : undefined
        }
      />
    </div>
  )
}
