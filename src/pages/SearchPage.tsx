import { useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Highlight } from '../components/Highlight'
import { PageHeader } from '../components/PageHeader'
import { useAsync } from '../hooks/useAsync'
import { useSearchEngine } from '../hooks/useSearchEngine'
import { listProductTree } from '../services/blocks'
import { registrarBuscaSemResultado } from '../services/search'
import type { ArticlePublico, CategoriaId } from '../types/content'
import { comDescendentes } from '../utils/blocos'
import { CATEGORIAS, nomeDaCategoria } from '../utils/categorias'
import { gerarTrecho } from '../utils/search'
import { parteDoBloco } from '../utils/searchIndex'
import type { SearchFilters } from '../utils/searchEngine'

const campo = 'campo h-10'
const SEM_UNIDADE = 'sem-unidade'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const unidade = params.get('unidade') ?? ''
  const produto = params.get('produto') ?? ''
  const subproduto = params.get('subproduto') ?? ''
  const categoria = (params.get('categoria') ?? '') as CategoriaId | ''
  const publico = (params.get('publico') ?? '') as ArticlePublico | ''
  const { dados, erro, carregando } = useSearchEngine()

  // A árvore do produto escolhido dá os subprodutos e o caminho de cada resultado.
  const { dados: arvore } = useAsync(
    async () => (produto ? await listProductTree(produto) : []),
    [produto],
  )

  const produtos = useMemo(() => dados?.produtos ?? [], [dados])
  const unidades = useMemo(() => dados?.unidades ?? [], [dados])
  const idsDeUnidades = useMemo(
    () => new Set(unidades.map((u) => u.id)),
    [unidades],
  )
  const semUnidade = (p: { unidadeId?: string | null }) =>
    !p.unidadeId || !idsDeUnidades.has(p.unidadeId)

  // Só aparecem as unidades que têm produto visível para quem busca.
  const unidadesVisiveis = unidades.filter((u) =>
    produtos.some((p) => p.unidadeId === u.id),
  )
  const temSolto = unidadesVisiveis.length > 0 && produtos.some(semUnidade)
  const produtosDoFiltro = produtos.filter((p) =>
    !unidade
      ? true
      : unidade === SEM_UNIDADE
        ? semUnidade(p)
        : p.unidadeId === unidade,
  )
  const subprodutos = (arvore ?? [])
    .filter((b) => b.parentId === produto)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))

  const filtros = useMemo<SearchFilters>(() => {
    const f: SearchFilters = {}
    if (produto) f.productId = produto
    else if (unidade) f.productIds = produtosDoFiltro.map((p) => p.id)
    if (subproduto && arvore) f.blockIds = comDescendentes(arvore, subproduto)
    if (categoria) f.categoria = categoria
    if (publico) f.publico = publico
    return f
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produto, unidade, subproduto, arvore, categoria, publico, produtos])

  const temFiltro = !!(unidade || produto || subproduto || categoria || publico)
  const navegando = !q.trim() && temFiltro

  const resultados = useMemo(() => {
    if (!dados) return []
    if (q.trim()) {
      return dados.motor
        .buscar(q, filtros)
        .map((h) => ({ item: h.item, termos: h.termos }))
    }
    return temFiltro
      ? dados.motor
          .listar(filtros)
          .map((item) => ({ item, termos: [] as string[] }))
      : []
  }, [dados, q, filtros, temFiltro])

  const semResultado =
    !!dados && (!!q.trim() || temFiltro) && resultados.length === 0
  useEffect(() => {
    // Só a busca sem filtros conta como "sem resultado" de verdade.
    if (semResultado && q.trim() && !temFiltro)
      void registrarBuscaSemResultado(q)
  }, [semResultado, q, temFiltro])

  function atualizar(mudancas: Record<string, string>) {
    const novo = new URLSearchParams(params)
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) novo.set(chave, valor)
      else novo.delete(chave)
    }
    setParams(novo, { replace: true })
  }

  const produtoPorId = new Map(produtos.map((p) => [p.id, p]))
  const unidadePorId = new Map(unidades.map((u) => [u.id, u]))

  function caminho(item: { productId: string; blockId: string }) {
    const p = produtoPorId.get(item.productId)
    const partes: string[] = []
    const u = p?.unidadeId ? unidadePorId.get(p.unidadeId) : undefined
    if (u) partes.push(u.nome)
    partes.push(p?.nome ?? item.productId)
    if (arvore && item.productId === produto) {
      const parte = parteDoBloco(arvore, item.blockId)
      const sub = arvore.find((b) => b.id === parte && b.parentId === produto)
      if (sub) partes.push(sub.nome)
    }
    return partes.join(' › ')
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icone={Search} titulo="Busca" />
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="mb-6 space-y-2"
      >
        <input
          type="search"
          aria-label="Termo de busca"
          value={q}
          onChange={(e) => atualizar({ q: e.target.value })}
          placeholder="Buscar por título ou conteúdo"
          className={`${campo} w-full`}
        />
        <div className="flex flex-wrap gap-2">
          {unidadesVisiveis.length > 0 && (
            <select
              aria-label="Filtrar por unidade de negócio"
              value={unidade}
              onChange={(e) =>
                atualizar({
                  unidade: e.target.value,
                  produto: '',
                  subproduto: '',
                })
              }
              className={campo}
            >
              <option value="">Todas as unidades</option>
              {unidadesVisiveis.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
              {temSolto && <option value={SEM_UNIDADE}>Sem unidade</option>}
            </select>
          )}
          <select
            aria-label="Filtrar por produto"
            value={produto}
            onChange={(e) =>
              atualizar({ produto: e.target.value, subproduto: '' })
            }
            className={campo}
          >
            <option value="">Todos os produtos</option>
            {produtosDoFiltro.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          {produto && subprodutos.length > 0 && (
            <select
              aria-label="Filtrar por subproduto"
              value={subproduto}
              onChange={(e) => atualizar({ subproduto: e.target.value })}
              className={campo}
            >
              <option value="">Todos os subprodutos</option>
              {subprodutos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Filtrar por categoria"
            value={categoria}
            onChange={(e) => atualizar({ categoria: e.target.value })}
            className={campo}
          >
            <option value="">Todas as categorias</option>
            {CATEGORIAS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por público"
            value={publico}
            onChange={(e) => atualizar({ publico: e.target.value })}
            className={campo}
          >
            <option value="">Todos os públicos</option>
            <option value="usuario">Usuário</option>
            <option value="tecnico">Técnico</option>
          </select>
          {temFiltro && (
            <button
              type="button"
              className="botao"
              onClick={() =>
                atualizar({
                  unidade: '',
                  produto: '',
                  subproduto: '',
                  categoria: '',
                  publico: '',
                })
              }
            >
              Limpar filtros
            </button>
          )}
        </div>
      </form>

      {carregando && !dados && <p className="text-suave">Carregando índice…</p>}
      {erro && (
        <p role="alert" className="text-perigo ">
          {erro}
        </p>
      )}
      {dados && !q.trim() && !temFiltro && (
        <p className="text-suave ">
          Digite para buscar em {dados.motor.total} artigos, ou escolha um
          filtro para navegar.{' '}
          <Link to="/categorias" className="text-bloco-icone hover:underline">
            Ver por categoria
          </Link>
        </p>
      )}
      {semResultado && (
        <p className="text-suave ">
          {q.trim()
            ? `Nenhum resultado para “${q}”.`
            : 'Nenhum artigo com esses filtros.'}
        </p>
      )}

      {resultados.length > 0 && (
        <>
          <p className="mb-3 text-sm text-suave" aria-live="polite">
            {resultados.length}{' '}
            {navegando
              ? resultados.length > 1
                ? 'artigos'
                : 'artigo'
              : resultados.length > 1
                ? 'resultados'
                : 'resultado'}
          </p>
          <ul className="space-y-3">
            {resultados.map(({ item, termos }) => (
              <li
                key={item.id}
                className="rounded-lg border border-borda bg-cartao p-4 "
              >
                <Link
                  to={`/a/${item.id}`}
                  className="font-medium text-bloco-icone hover:underline "
                >
                  <Highlight partes={gerarTrecho(item.titulo, termos, 120)} />
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-suave">
                  <span>{caminho(item)}</span>
                  {nomeDaCategoria(item.categoria) && (
                    <span className="selo">
                      {nomeDaCategoria(item.categoria)}
                    </span>
                  )}
                  {item.publico === 'tecnico' && (
                    <span className="selo">Técnico</span>
                  )}
                </p>
                <p className="mt-2 text-sm text-texto ">
                  <Highlight
                    partes={gerarTrecho(
                      termos.length > 0
                        ? item.textoPlano || item.resumo
                        : item.resumo || item.textoPlano,
                      termos,
                    )}
                  />
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
