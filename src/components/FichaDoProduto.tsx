import { useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Ficha, SecaoFicha } from '../types/content'
import { ValorDaOpcao } from './ValorDaOpcao'

const rotuloDaAba = (s: SecaoFicha, i: number) => s.titulo || `Seção ${i + 1}`

interface Props {
  ficha: Ficha
  /** Fica no alto da coluna da esquerda, acima do conteúdo da aba (a descrição). */
  topo?: ReactNode
  /** Fica embaixo da lista de opções, na coluna da direita (ex.: "Editar"). */
  acoes?: ReactNode
  /** Avisa que as opções ainda não foram salvas (estrutura padrão). */
  aviso?: string
  /** Admin: abas sem conteúdo mostram a dica de preencher. */
  admin?: boolean
}

/**
 * Informações do produto que mudam a cada liberação (compatibilidade,
 * instaladores…). À esquerda ficam a descrição e o conteúdo da opção
 * escolhida; à direita, a lista de opções como abas na lateral. Em tela
 * pequena a lista vai para cima.
 */
export function FichaDoProduto({
  ficha,
  topo,
  acoes,
  aviso,
  admin = false,
}: Props) {
  const [escolhida, setEscolhida] = useState(ficha.secoes[0]?.id ?? '')
  const indice = Math.max(
    0,
    ficha.secoes.findIndex((s) => s.id === escolhida),
  )
  const atual = ficha.secoes[indice]
  if (ficha.secoes.length === 0 && !topo) return null

  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    const passo =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? -1
          : 0
    let alvo = indice + passo
    if (e.key === 'Home') alvo = 0
    else if (e.key === 'End') alvo = ficha.secoes.length - 1
    else if (!passo) return
    alvo = (alvo + ficha.secoes.length) % ficha.secoes.length
    e.preventDefault()
    const id = (ficha.secoes[alvo] as SecaoFicha).id
    setEscolhida(id)
    document.getElementById(`aba-${id}`)?.focus()
  }

  return (
    <div
      className={`grid items-start gap-6 ${ficha.secoes.length > 0 ? 'lg:grid-cols-[minmax(0,1fr)_300px]' : ''}`}
    >
      <div className="min-w-0 space-y-6">
        {topo}
        {atual && (
          <div
            role="tabpanel"
            id={`painel-${atual.id}`}
            aria-labelledby={`aba-${atual.id}`}
            className="cartao p-6"
          >
            <ValorDaOpcao secao={atual} admin={admin} />
          </div>
        )}
      </div>

      {ficha.secoes.length > 0 && (
        <aside
          aria-label="Opções do produto"
          className="order-first space-y-3 lg:sticky lg:top-6 lg:order-none"
        >
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label="Informações do produto"
            onKeyDown={aoTeclar}
            className="cartao overflow-hidden p-2"
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
                  className={`flex w-full items-center rounded-xl border-l-4 px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-wide transition ${
                    ativa
                      ? 'border-destaque bg-bloco text-destaque'
                      : 'border-transparent text-suave hover:bg-bloco/50 hover:text-texto'
                  }`}
                >
                  {rotuloDaAba(s, i)}
                </button>
              )
            })}
          </div>
          {aviso && <p className="px-1 text-xs text-suave">{aviso}</p>}
          {acoes}
        </aside>
      )}
    </div>
  )
}
