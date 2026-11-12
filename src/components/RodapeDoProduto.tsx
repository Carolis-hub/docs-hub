import type { Block } from '../types/content'
import { normalizarRodape } from '../utils/rodape'
import { LinkDoRodape, MarkdownRodape } from './MarkdownRodape'

/**
 * Rodapé do produto, mostrado em todas as páginas dele. Quem usa passa o
 * **produto** (raiz da cadeia): subprodutos, módulos e artigos herdam o
 * rodapé dele, então a configuração é feita uma vez só. Sem configuração, não
 * desenha nada (nem o espaço vazio).
 */
export function RodapeDoProduto({ produto }: { produto?: Block | null }) {
  const rodape = normalizarRodape(produto?.rodape)
  if (!rodape) return null
  return (
    <footer
      aria-label={`Rodapé de ${produto?.nome ?? 'produto'}`}
      className="mt-16 rounded-3xl border border-borda bg-cartao px-8 py-8"
    >
      <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {rodape.colunas.map((c) => (
          <section key={c.id} aria-label={c.titulo || 'Coluna'}>
            {c.titulo && (
              <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-suave">
                {c.titulo}
              </h2>
            )}
            <ul className="space-y-3 text-sm">
              {c.itens.map((i) => (
                <li key={i.id}>
                  {i.url ? (
                    <LinkDoRodape
                      url={i.url}
                      className="font-semibold text-texto transition hover:text-destaque hover:underline"
                    >
                      {i.titulo}
                    </LinkDoRodape>
                  ) : (
                    <span className="font-semibold text-texto">{i.titulo}</span>
                  )}
                  {i.conteudo && (
                    <div className="mt-1 text-suave">
                      <MarkdownRodape texto={i.conteudo} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </footer>
  )
}
