import { X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ItemRodape } from '../types/content'
import { LIMITES_RODAPE, novoIdDoRodape, urlDoRodape } from '../utils/rodape'
import { MarkdownRodape } from './MarkdownRodape'

interface Props {
  /** Sem `item`, é um item novo. */
  item?: ItemRodape
  aoSalvar: (item: ItemRodape) => void
  aoCancelar: () => void
}

/** Modal para adicionar ou editar um item do rodapé: título, link e Markdown. */
export function ModalItemRodape({ item, aoSalvar, aoCancelar }: Props) {
  const [titulo, setTitulo] = useState(item?.titulo ?? '')
  const [url, setUrl] = useState(item?.url ?? '')
  const [conteudo, setConteudo] = useState(item?.conteudo ?? '')
  const [linkTexto, setLinkTexto] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [inserindo, setInserindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const tocou = useRef(false)

  useEffect(() => {
    const fechar = (e: KeyboardEvent) => e.key === 'Escape' && aoCancelar()
    window.addEventListener('keydown', fechar)
    return () => window.removeEventListener('keydown', fechar)
  }, [aoCancelar])

  /** Coloca `antes`/`depois` em volta da seleção (ou de um texto de exemplo). */
  function envolver(antes: string, depois: string, exemplo: string) {
    const el = area.current
    const ini = el?.selectionStart ?? conteudo.length
    const fim = el?.selectionEnd ?? conteudo.length
    const meio = conteudo.slice(ini, fim) || exemplo
    setConteudo(
      conteudo.slice(0, ini) + antes + meio + depois + conteudo.slice(fim),
    )
    el?.focus()
  }

  /**
   * Aplica `f` à linha onde está o cursor (ou à seleção inteira, linha a linha
   * não é necessário: vale a linha do cursor). Tira marcas antigas de título e
   * alinhamento antes, para o botão poder ser clicado de novo sem acumular.
   */
  function linhaAtual(f: (linha: string) => string) {
    const el = area.current
    const pos = el && tocou.current ? el.selectionStart : conteudo.length
    const ini = conteudo.lastIndexOf('\n', pos - 1) + 1
    const fimBusca = conteudo.indexOf('\n', pos)
    const fim = fimBusca === -1 ? conteudo.length : fimBusca
    const limpa = conteudo
      .slice(ini, fim)
      .trim()
      .replace(/^->\s*(.*?)\s*(<-|->)$/, '$1')
      .replace(/^#{1,3}\s+/, '')
    setConteudo(conteudo.slice(0, ini) + f(limpa) + conteudo.slice(fim))
    el?.focus()
  }

  /** Insere uma tabela de exemplo em linhas próprias, na posição do cursor. */
  function inserirTabela() {
    const el = area.current
    // Sem ter clicado no texto ainda, a tabela vai para o fim (não para o começo).
    const pos = el && tocou.current ? el.selectionEnd : conteudo.length
    const antes = conteudo.slice(0, pos)
    const depois = conteudo.slice(pos)
    const modelo = [
      '| Coluna 1 | Coluna 2 | Coluna 3 |',
      '| --- | --- | --- |',
      '| valor | valor | valor |',
      '| valor | valor | valor |',
    ].join('\n')
    setConteudo(
      antes +
        (antes && !antes.endsWith('\n') ? '\n' : '') +
        modelo +
        (depois.startsWith('\n') ? '' : '\n') +
        depois,
    )
    el?.focus()
  }

  function inserirLink() {
    const endereco = urlDoRodape(linkUrl)
    if (!endereco) {
      setErro(
        'Link inválido: use http://, https://, mailto: ou um caminho como /b/…',
      )
      return
    }
    setErro(null)
    const texto = (linkTexto.trim() || endereco).replace(/([[\]\\])/g, '\\$1')
    const el = area.current
    const pos = el?.selectionEnd ?? conteudo.length
    const md = `[${texto}](${endereco.replace(/([()\\])/g, '\\$1')})`
    setConteudo(conteudo.slice(0, pos) + md + conteudo.slice(pos))
    setLinkTexto('')
    setLinkUrl('')
    setInserindo(false)
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!titulo.trim()) {
      setErro('Informe o nome do item.')
      return
    }
    if (url.trim() && !urlDoRodape(url)) {
      setErro(
        'Link do título inválido: use http://, https://, mailto: ou um caminho como /b/…',
      )
      return
    }
    aoSalvar({
      id: item?.id ?? novoIdDoRodape(),
      titulo: titulo.trim(),
      url: urlDoRodape(url),
      conteudo,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && aoCancelar()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={item ? 'Editar item do rodapé' : 'Novo item do rodapé'}
        onSubmit={enviar}
        className="cartao max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto p-6 pt-0"
      >
        {/* Fica fixo no topo: dá para fechar sem rolar até o fim da janela. */}
        <div className="sticky top-0 z-10 -mx-6 flex items-center justify-between gap-2 border-b border-borda bg-cartao px-6 py-4">
          <h3 className="text-lg font-bold">
            {item ? 'Editar item do rodapé' : 'Novo item do rodapé'}
          </h3>
          <button
            type="button"
            className="botao h-9 w-9 shrink-0 p-0"
            aria-label="Fechar"
            title="Fechar (Esc)"
            onClick={aoCancelar}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <label className="block text-sm">
          Nome do item
          <input
            className="campo mt-1"
            value={titulo}
            maxLength={LIMITES_RODAPE.titulo}
            onChange={(e) => setTitulo(e.target.value)}
            autoFocus
          />
        </label>
        <label className="block text-sm">
          Link (opcional)
          <input
            className="campo mt-1"
            value={url}
            placeholder="https://… ou /b/identificador-do-bloco"
            onChange={(e) => setUrl(e.target.value)}
          />
          <span className="mt-1 block text-xs text-suave">
            Para levar a um conteúdo do sistema, use o caminho, por exemplo
            /a/identificador-do-artigo. Sem conteúdo, o título abre o link
            direto; com conteúdo, o link aparece no fim da janela.
          </span>
        </label>

        <div className="text-sm">
          <label htmlFor="conteudo-item" className="block">
            Conteúdo (Markdown)
          </label>
          <div className="mt-1 flex flex-wrap gap-1">
            <button
              type="button"
              className="botao h-8 px-2.5"
              onClick={() => linhaAtual((l) => `## ${l || 'Título'}`)}
            >
              Título
            </button>
            <button
              type="button"
              className="botao h-8 px-2.5"
              onClick={() =>
                linhaAtual((l) => `->${l || 'Texto centralizado'}<-`)
              }
            >
              Centralizar
            </button>
            <button
              type="button"
              className="botao h-8 px-2.5"
              onClick={() => envolver('**', '**', 'negrito')}
            >
              Negrito
            </button>
            <button
              type="button"
              className="botao h-8 px-2.5"
              onClick={() => envolver('*', '*', 'itálico')}
            >
              Itálico
            </button>
            <button
              type="button"
              className="botao h-8 px-2.5"
              onClick={() => envolver('\n- ', '', 'item da lista')}
            >
              Lista
            </button>
            <button
              type="button"
              className="botao h-8 px-2.5"
              onClick={inserirTabela}
            >
              Tabela
            </button>
            <button
              type="button"
              className="botao h-8 px-2.5"
              aria-expanded={inserindo}
              onClick={() => {
                const el = area.current
                const sel = el
                  ? conteudo.slice(el.selectionStart, el.selectionEnd)
                  : ''
                if (sel) setLinkTexto(sel)
                setInserindo((v) => !v)
              }}
            >
              Inserir link
            </button>
          </div>
          {inserindo && (
            <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-fundo p-3">
              <label className="min-w-[140px] flex-1 text-xs">
                Texto do link
                <input
                  className="campo mt-1"
                  value={linkTexto}
                  onChange={(e) => setLinkTexto(e.target.value)}
                />
              </label>
              <label className="min-w-[180px] flex-[2] text-xs">
                Endereço
                <input
                  className="campo mt-1"
                  value={linkUrl}
                  placeholder="https://…"
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="botao botao-primario h-9"
                onClick={inserirLink}
              >
                Inserir
              </button>
            </div>
          )}
          <textarea
            id="conteudo-item"
            ref={area}
            onFocus={() => (tocou.current = true)}
            rows={10}
            maxLength={LIMITES_RODAPE.conteudo}
            className="campo mt-2 font-mono text-[13px]"
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
          />
          <p className="mt-1 text-xs text-suave">
            Aceita **negrito**, *itálico*, títulos com “## ”, listas com “-”,
            [texto](link), tabelas e escape com barra invertida (\*, \[, \]). Na
            tabela, cada linha começa e termina com “|”, e as células são
            separadas por “|”; para mais colunas ou linhas, repita o padrão.
            Para centralizar uma linha, escreva “{'->texto<-'}” (ou use o botão
            Centralizar); na tabela, “:---:” centraliza a coluna.
          </p>
        </div>

        <div
          aria-label="Prévia do conteúdo"
          className="rounded-xl bg-fundo p-3 text-sm"
        >
          <p className="mb-1 text-xs font-semibold text-suave">Prévia</p>
          {conteudo.trim() ? (
            <MarkdownRodape texto={conteudo} />
          ) : (
            <p className="italic text-suave">Sem conteúdo.</p>
          )}
        </div>

        {erro && (
          <p role="alert" className="text-sm text-perigo">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="botao" onClick={aoCancelar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao-primario">
            Salvar item
          </button>
        </div>
      </form>
    </div>
  )
}
