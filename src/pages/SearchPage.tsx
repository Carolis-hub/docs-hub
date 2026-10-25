import { useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Highlight } from '../components/Highlight'
import { PageHeader } from '../components/PageHeader'
import { useSearchEngine } from '../hooks/useSearchEngine'
import { registrarBuscaSemResultado } from '../services/search'
import type { ArticlePublico } from '../types/content'
import { gerarTrecho } from '../utils/search'

const campo = 'campo h-10'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const produto = params.get('produto') ?? ''
  const publico = (params.get('publico') ?? '') as ArticlePublico | ''
  const { dados, erro, carregando } = useSearchEngine()

  const resultados = useMemo(
    () =>
      dados?.motor.buscar(q, {
        productId: produto || undefined,
        publico: publico || undefined,
      }) ?? [],
    [dados, q, produto, publico],
  )

  const semResultado = !!dados && !!q.trim() && resultados.length === 0
  useEffect(() => {
    // Só a busca sem filtros conta como "sem resultado" de verdade.
    if (semResultado && !produto && !publico) {
      void registrarBuscaSemResultado(q)
    }
  }, [semResultado, q, produto, publico])

  function atualizar(chave: string, valor: string) {
    const novo = new URLSearchParams(params)
    if (valor) novo.set(chave, valor)
    else novo.delete(chave)
    setParams(novo, { replace: true })
  }

  const nomeProduto = new Map(
    (dados?.produtos ?? []).map((p) => [p.id, p.nome]),
  )

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icone={Search} titulo="Busca" />
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="mb-6 flex flex-wrap gap-2"
      >
        <input
          type="search"
          aria-label="Termo de busca"
          value={q}
          onChange={(e) => atualizar('q', e.target.value)}
          placeholder="Buscar por título ou conteúdo"
          className={`${campo} min-w-0 flex-1`}
        />
        <select
          aria-label="Filtrar por produto"
          value={produto}
          onChange={(e) => atualizar('produto', e.target.value)}
          className={campo}
        >
          <option value="">Todos os produtos</option>
          {(dados?.produtos ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por público"
          value={publico}
          onChange={(e) => atualizar('publico', e.target.value)}
          className={campo}
        >
          <option value="">Todos os públicos</option>
          <option value="usuario">Usuário</option>
          <option value="tecnico">Técnico</option>
        </select>
      </form>

      {carregando && !dados && <p className="text-suave">Carregando índice…</p>}
      {erro && (
        <p role="alert" className="text-perigo ">
          {erro}
        </p>
      )}
      {dados && !q.trim() && (
        <p className="text-suave ">
          Digite para buscar em {dados.motor.total} artigos.
        </p>
      )}
      {semResultado && (
        <p className="text-suave ">Nenhum resultado para “{q}”.</p>
      )}

      {resultados.length > 0 && (
        <>
          <p className="mb-3 text-sm text-suave" aria-live="polite">
            {resultados.length} resultado{resultados.length > 1 ? 's' : ''}
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
                <p className="mt-0.5 text-xs text-suave">
                  {nomeProduto.get(item.productId) ?? item.productId}
                  {item.publico === 'tecnico' && ' · Técnico'}
                </p>
                <p className="mt-2 text-sm text-texto ">
                  <Highlight
                    partes={gerarTrecho(item.textoPlano || item.resumo, termos)}
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
