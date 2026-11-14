import { PanelBottom, Settings, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Block, ItemRodape } from '../types/content'
import { normalizarRodape } from '../utils/rodape'
import { EditorDoRodape } from './EditorDoRodape'
import { LinkDoRodape, MarkdownRodape } from './MarkdownRodape'

interface Props {
  produto?: Block | null
  /**
   * Quando informado (só para admin), a configuração do rodapé fica aqui
   * mesmo, no lugar do rodapé: um botão troca a visualização pelo editor.
   */
  configuracao?: { uid: string; aoSalvar: () => void }
}

const ESTILO_DO_TITULO =
  'text-left font-medium text-texto transition hover:text-destaque hover:underline'

/**
 * Rodapé do produto, mostrado em todas as páginas dele. Quem usa passa o
 * **produto** (raiz da cadeia): subprodutos, módulos e artigos herdam o
 * rodapé dele, então a configuração é feita uma vez só. Na tela aparecem só o
 * nome de cada coluna e o título das opções; o conteúdo de uma opção abre em
 * uma janela ao clicar no título. Sem configuração, não desenha nada (para o
 * admin, um convite para configurar).
 */
export function RodapeDoProduto({ produto, configuracao }: Props) {
  const [configurando, setConfigurando] = useState(false)
  const [aberto, setAberto] = useState<ItemRodape | null>(null)
  const rodape = normalizarRodape(produto?.rodape)

  if (produto && configuracao && configurando) {
    return (
      <div className="mt-16">
        <EditorDoRodape
          key={produto.id}
          produto={produto}
          uid={configuracao.uid}
          aoSalvar={configuracao.aoSalvar}
          aoFechar={() => setConfigurando(false)}
        />
      </div>
    )
  }

  if (!rodape) {
    if (!produto || !configuracao) return null
    return (
      <button
        type="button"
        onClick={() => setConfigurando(true)}
        className="mt-16 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-borda p-4 text-sm text-suave transition hover:border-destaque/60 hover:text-texto"
      >
        <PanelBottom className="size-4" aria-hidden />
        Este produto ainda não tem rodapé. Configurar rodapé
      </button>
    )
  }

  return (
    <footer
      aria-label={`Rodapé de ${produto?.nome ?? 'produto'}`}
      className="mt-16 rounded-3xl border border-borda bg-cartao px-8 py-8"
    >
      <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {rodape.colunas.map((c) => (
          <section key={c.id} aria-label={c.titulo || 'Coluna'}>
            {c.titulo && (
              <h2 className="mb-4 text-[14px] font-semibold text-suave">
                <span aria-hidden className="mr-1 text-destaque">
                  //
                </span>
                {c.titulo}
              </h2>
            )}
            <ul className="space-y-3 text-sm">
              {c.itens.map((i) => (
                <li key={i.id}>
                  {i.conteudo ? (
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      className={ESTILO_DO_TITULO}
                      onClick={() => setAberto(i)}
                    >
                      {i.titulo}
                    </button>
                  ) : i.url ? (
                    <LinkDoRodape url={i.url} className={ESTILO_DO_TITULO}>
                      {i.titulo}
                    </LinkDoRodape>
                  ) : (
                    <span className="font-medium text-texto">{i.titulo}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {configuracao && (
        <div className="mt-8 border-t border-borda pt-4">
          <button
            type="button"
            className="botao"
            onClick={() => setConfigurando(true)}
          >
            <Settings className="size-4" aria-hidden />
            Configurar rodapé
          </button>
        </div>
      )}
      {aberto && <ModalDoItem item={aberto} aoFechar={() => setAberto(null)} />}
    </footer>
  )
}

/** Janela com o conteúdo de uma opção do rodapé (texto, listas, links e tabelas). */
function ModalDoItem({
  item,
  aoFechar,
}: {
  item: ItemRodape
  aoFechar: () => void
}) {
  useEffect(() => {
    const fechar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', fechar)
    return () => window.removeEventListener('keydown', fechar)
  }, [aoFechar])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.titulo}
        className="cartao max-h-[85vh] w-full max-w-3xl overflow-y-auto p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-bold">{item.titulo}</h3>
          <button
            type="button"
            className="botao-icone shrink-0"
            aria-label="Fechar"
            autoFocus
            onClick={aoFechar}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="mt-4 text-sm text-texto">
          <MarkdownRodape texto={item.conteudo} />
        </div>
        {item.url && (
          <p className="mt-5 border-t border-borda pt-4 text-sm">
            <LinkDoRodape url={item.url} className="text-destaque underline">
              Abrir a página de {item.titulo}
            </LinkDoRodape>
          </p>
        )}
      </div>
    </div>
  )
}
