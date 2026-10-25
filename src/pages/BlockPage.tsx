import { useMemo, useState } from 'react'
import { FolderPlus, Layers, Pencil, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ArticleList } from '../components/ArticleList'
import { BlockCards } from '../components/BlockCards'
import { BlockForm } from '../components/BlockForm'
import { Breadcrumb } from '../components/Breadcrumb'
import {
  AlternarVisao,
  BotaoOrdenar,
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
  reorderBlocks,
  updateBlock,
} from '../services/blocks'
import { listArticlesByBlock } from '../services/articles'
import type { Block } from '../types/content'
import { iconeDoArtigo } from '../utils/iconeDoArtigo'
import { normalizar } from '../utils/search'

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`

export function BlockPage() {
  const { blockId = '' } = useParams()
  const { user, isAdmin } = useAuth()
  const uid = user?.uid ?? ''
  const { dados, erro, carregando, recarregar } = useAsync(async () => {
    const bloco = await getBlock(blockId)
    if (!bloco) return null
    const [cadeia, filhos, artigos] = await Promise.all([
      getAncestors(bloco),
      listChildren(blockId),
      listArticlesByBlock(blockId, !isAdmin),
    ])
    return { bloco, cadeia, filhos, artigos }
  }, [blockId, isAdmin])

  const [modo, setModo] = useState<'novo' | 'editar' | null>(null)
  const [editandoFilho, setEditandoFilho] = useState<Block | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [organizar, setOrganizar] = useState(false)
  const [filtroSecoes, setFiltroSecoes] = useState('')
  const [filtroArtigos, setFiltroArtigos] = useState('')
  const [crescente, setCrescente] = useState(true)
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
      (a) => !q || normalizar(`${a.titulo} ${a.resumo}`).includes(q),
    )
    const ordenada = [...lista].sort((a, b) =>
      a.titulo.localeCompare(b.titulo, 'pt-BR'),
    )
    return crescente ? ordenada : ordenada.reverse()
  }, [dados, filtroArtigos, crescente])

  if (carregando && !dados) return <p className="text-suave">Carregando…</p>
  if (erro)
    return (
      <p role="alert" className="text-perigo">
        {erro}
      </p>
    )
  if (!dados) return <p>Bloco não encontrado.</p>

  const { bloco, cadeia, filhos, artigos: todosArtigos } = dados
  const ehProduto = bloco.parentId === null

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

  const subtitulo = ehProduto
    ? `Produto · ${plural(filhos.length, 'subproduto ou seção', 'subprodutos e seções')}`
    : bloco.descricao || undefined

  return (
    <div>
      <Breadcrumb cadeia={cadeia} />
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
                Editar bloco
              </button>
              <button
                type="button"
                onClick={() => setModo('novo')}
                className="botao"
              >
                <FolderPlus className="size-4" aria-hidden />
                Novo subbloco
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
          titulo="Novo subbloco"
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
          titulo="Editar bloco"
          inicial={bloco}
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
          titulo="Editar subbloco"
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

      {filhos.length > 0 && (
        <section className="mb-10" aria-label="Subprodutos e seções">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <TituloDeSecao
              titulo="Subprodutos e seções"
              total={filhos.length}
            />
            <div className="flex flex-wrap items-center gap-2">
              <FiltroDaLista
                valor={filtroSecoes}
                aoMudar={setFiltroSecoes}
                placeholder="Filtrar seções…"
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
            editavel={isAdmin}
            organizar={isAdmin && organizar && filtroSecoes.trim() === ''}
            onReorder={(o) =>
              void reorderBlocks(o.map((b) => b.id)).then(recarregar)
            }
            onEdit={setEditandoFilho}
            onDelete={(b) => void excluirFilho(b)}
            onNovo={isAdmin ? () => setModo('novo') : undefined}
          />
          {organizar && filtroSecoes.trim() !== '' && (
            <p className="mt-2 text-xs text-suave">
              Limpe o filtro para arrastar e reordenar.
            </p>
          )}
        </section>
      )}

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
              <BotaoOrdenar
                crescente={crescente}
                aoAlternar={() => setCrescente((c) => !c)}
              />
              <AlternarVisao visao={visao} aoMudar={setVisao} />
            </div>
          </div>
          {todosArtigos.length === 0 ? (
            <p className="text-suave">Nenhum artigo neste bloco.</p>
          ) : artigos.length === 0 ? (
            <p className="text-suave">Nenhum artigo corresponde ao filtro.</p>
          ) : (
            <ArticleList artigos={artigos} visao={visao} admin={isAdmin} />
          )}
        </section>
      )}
    </div>
  )
}
