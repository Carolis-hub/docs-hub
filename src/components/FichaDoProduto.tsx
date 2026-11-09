import { useState, type KeyboardEvent } from 'react'
import { ExternalLink } from 'lucide-react'
import type { Ficha, SecaoFicha } from '../types/content'
import { urlSegura } from '../utils/ficha'
import { TextoRico } from './TextoRico'

function Celula({ texto }: { texto: string }) {
  // Dentro da tabela só interessa o negrito (versões homologadas); links viram texto.
  const partes = texto.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} className="text-destaque">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

function Secao({ secao }: { secao: SecaoFicha }) {
  return (
    <div className="min-w-0">
      {secao.titulo && (
        <h3 className="text-lg font-extrabold tracking-tight">
          {secao.titulo}
        </h3>
      )}
      {secao.texto && (
        <TextoRico
          texto={secao.texto}
          className="mt-2 text-sm leading-relaxed text-texto/80"
        />
      )}
      {secao.tipo === 'tabela' && secao.colunas.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-borda">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="bg-bloco">
                {secao.colunas.map((c, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="px-3 py-2 text-left font-semibold"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {secao.linhas.map((l, i) => (
                <tr key={i} className="border-t border-borda">
                  {secao.colunas.map((_, j) => (
                    <td key={j} className="px-3 py-2">
                      <Celula texto={l[j] ?? ''} />
                    </td>
                  ))}
                </tr>
              ))}
              {secao.linhas.length === 0 && (
                <tr>
                  <td
                    colSpan={secao.colunas.length}
                    className="px-3 py-3 text-suave"
                  >
                    Sem versões cadastradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {secao.tipo === 'links' && secao.itens.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {secao.itens.map((item, i) => {
            const url = urlSegura(item.url)
            return (
              <li key={i}>
                {url ? (
                  <a
                    href={url}
                    target={url.startsWith('mailto:') ? undefined : '_blank'}
                    rel="noopener noreferrer"
                    className="botao"
                  >
                    {item.rotulo}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : (
                  <span className="selo">{item.rotulo}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const rotuloDaAba = (s: SecaoFicha, i: number) => s.titulo || `Seção ${i + 1}`

/**
 * Informações do produto que mudam a cada liberação (compatibilidade,
 * instaladores…). Cada seção é uma aba no topo, como no portal atual; a aba
 * escolhida ocupa toda a largura.
 */
export function FichaDoProduto({ ficha }: { ficha: Ficha }) {
  const [escolhida, setEscolhida] = useState(ficha.secoes[0]?.id ?? '')
  if (ficha.secoes.length === 0) return null
  const indice = Math.max(
    0,
    ficha.secoes.findIndex((s) => s.id === escolhida),
  )
  const atual = ficha.secoes[indice] as SecaoFicha

  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    const passo = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    let alvo = indice + passo
    if (e.key === 'Home') alvo = 0
    else if (e.key === 'End') alvo = ficha.secoes.length - 1
    else if (!passo) return
    alvo = (alvo + ficha.secoes.length) % ficha.secoes.length
    e.preventDefault()
    setEscolhida((ficha.secoes[alvo] as SecaoFicha).id)
    document
      .getElementById(`aba-${(ficha.secoes[alvo] as SecaoFicha).id}`)
      ?.focus()
  }

  return (
    <div className="cartao overflow-hidden">
      <div
        role="tablist"
        aria-label="Informações do produto"
        onKeyDown={aoTeclar}
        className="flex flex-wrap gap-1 border-b border-borda bg-bloco/50 px-3 pt-2"
      >
        {ficha.secoes.map((s, i) => {
          const ativa = i === indice
          return (
            <button
              key={s.id}
              id={`aba-${s.id}`}
              type="button"
              role="tab"
              aria-selected={ativa}
              aria-controls={`painel-${s.id}`}
              tabIndex={ativa ? 0 : -1}
              onClick={() => setEscolhida(s.id)}
              className={`-mb-px rounded-t-xl border-b-2 px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wide transition ${
                ativa
                  ? 'border-destaque bg-cartao text-destaque'
                  : 'border-transparent text-suave hover:text-texto'
              }`}
            >
              {rotuloDaAba(s, i)}
            </button>
          )
        })}
      </div>
      <div
        role="tabpanel"
        id={`painel-${atual.id}`}
        aria-labelledby={`aba-${atual.id}`}
        className="p-6"
      >
        <Secao secao={atual} />
      </div>
    </div>
  )
}
