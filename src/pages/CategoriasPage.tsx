import { useMemo } from 'react'
import {
  Boxes,
  Cog,
  ListChecks,
  Scale,
  Tags,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useProdutoEmContexto } from '../hooks/useProdutoEmContexto'
import { useSearchEngine } from '../hooks/useSearchEngine'
import type { CategoriaId } from '../types/content'
import { CATEGORIAS } from '../utils/categorias'
import { Carregando } from '../components/Carregando'

const ICONES: Record<CategoriaId, LucideIcon> = {
  funcionalidades: Boxes,
  configuracoes: Cog,
  processos: ListChecks,
  'regras-de-negocio': Scale,
}

const DESCRICOES: Record<CategoriaId, string> = {
  funcionalidades: 'O que o produto faz e como usar cada recurso.',
  configuracoes: 'Parâmetros, instalação e ajustes do sistema.',
  processos: 'Passo a passo e fluxos de trabalho.',
  'regras-de-negocio': 'Validações, limites e políticas aplicadas.',
}

const plural = (n: number) => `${n} ${n === 1 ? 'artigo' : 'artigos'}`

/** Entrada por categoria: quantos artigos há em cada uma e atalho para navegá-los. */
export function CategoriasPage() {
  const { dados, erro, carregando } = useSearchEngine()
  const [, definirProduto] = useProdutoEmContexto()
  const produtos = dados?.produtos ?? []
  const produtoId = dados?.produtoId ?? ''

  const contagem = useMemo(() => {
    const itens = dados?.motor.listar() ?? []
    const porCategoria = new Map<string, number>()
    for (const i of itens) {
      const chave = i.categoria || ''
      porCategoria.set(chave, (porCategoria.get(chave) ?? 0) + 1)
    }
    return { porCategoria, total: itens.length }
  }, [dados])

  const semCategoria = contagem.porCategoria.get('') ?? 0

  return (
    <div>
      <PageHeader
        icone={Tags}
        titulo="Categorias"
        subtitulo="Explore a documentação pelo tipo de assunto."
      />
      {carregando && !dados && <Carregando />}
      {erro && (
        <p role="alert" className="text-perigo">
          {erro}
        </p>
      )}
      {dados && produtos.length > 1 && (
        <label className="mb-4 flex flex-wrap items-center gap-2 text-sm text-suave">
          Produto
          <select
            aria-label="Produto"
            value={produtoId}
            onChange={(e) => definirProduto(e.target.value)}
            className="campo h-10"
          >
            {!produtoId && <option value="">Escolha um produto</option>}
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      {dados && produtos.length > 1 && !produtoId && (
        <p className="text-suave">
          Escolha um produto para ver as categorias dele.
        </p>
      )}
      {dados && (produtoId || produtos.length <= 1) && (
        <>
          <ul className="grid gap-4 sm:grid-cols-2">
            {CATEGORIAS.map((c) => {
              const Icone = ICONES[c.id]
              const n = contagem.porCategoria.get(c.id) ?? 0
              return (
                <li key={c.id}>
                  <Link
                    to={`/busca?categoria=${c.id}`}
                    className="cartao flex h-full gap-4 p-5 transition hover:border-destaque/50"
                  >
                    <span className="tile size-11">
                      <Icone className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{c.nome}</span>
                      <span className="block text-sm text-suave">
                        {DESCRICOES[c.id]}
                      </span>
                      <span className="mt-2 block text-sm font-medium">
                        {plural(n)}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          {semCategoria > 0 && (
            <p className="mt-6 text-sm text-suave">
              {plural(semCategoria)} ainda sem categoria (de {contagem.total}).
              Use a{' '}
              <Link to="/busca" className="text-bloco-icone hover:underline">
                busca
              </Link>{' '}
              para encontrá-los.
            </p>
          )}
        </>
      )}
    </div>
  )
}
