import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { salvarRodape } from '../services/blocks'
import type { Block, ColunaRodape, ItemRodape } from '../types/content'
import {
  LIMITES_RODAPE,
  mover,
  normalizarRodape,
  novoIdDoRodape,
} from '../utils/rodape'
import { ModalItemRodape } from './ModalItemRodape'

interface Props {
  produto: Block
  uid: string
  /** Chamado depois de gravar, para a tela recarregar. */
  aoSalvar: () => void
  /** Quando informado, mostra o botão "Fechar" (editor aberto sozinho, fora da edição do produto). */
  aoFechar?: () => void
}

type Modal = { coluna: string; item?: ItemRodape } | null

/**
 * Configura o rodapé do produto: colunas lado a lado, cada uma com seus itens.
 * Fica no fim da edição do produto; subprodutos, módulos e artigos herdam.
 */
export function EditorDoRodape({ produto, uid, aoSalvar, aoFechar }: Props) {
  const [colunas, setColunas] = useState<ColunaRodape[]>(
    () => produto.rodape?.colunas ?? [],
  )
  const [modal, setModal] = useState<Modal>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)

  const alterar = (novas: ColunaRodape[]) => {
    setColunas(novas)
    setSalvo(false)
  }
  const mudarColuna = (id: string, f: (c: ColunaRodape) => ColunaRodape) =>
    alterar(colunas.map((c) => (c.id === id ? f(c) : c)))

  function salvarItem(item: ItemRodape) {
    if (!modal) return
    mudarColuna(modal.coluna, (c) => ({
      ...c,
      itens: c.itens.some((i) => i.id === item.id)
        ? c.itens.map((i) => (i.id === item.id ? item : i))
        : [...c.itens, item],
    }))
    setModal(null)
  }

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      const gravado = await salvarRodape(produto.id, { colunas }, uid)
      setColunas(gravado?.colunas ?? [])
      setSalvo(true)
      aoSalvar()
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : 'Não foi possível salvar o rodapé.',
      )
    } finally {
      setSalvando(false)
    }
  }

  const vazio = normalizarRodape({ colunas }) === null

  return (
    <section
      aria-labelledby="rodape-titulo"
      className="cartao mt-6 space-y-4 p-5"
    >
      <div>
        <h2 id="rodape-titulo" className="text-lg font-bold">
          Rodapé do produto
        </h2>
        <p className="text-sm text-suave">
          Aparece em todas as páginas de {produto.nome}: subprodutos, módulos e
          artigos herdam esta configuração. Sem colunas, o rodapé não é exibido.
        </p>
      </div>

      {colunas.length === 0 ? (
        <p className="text-sm italic text-suave">Nenhuma coluna ainda.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {colunas.map((c, ci) => (
            <fieldset
              key={c.id}
              className="space-y-3 rounded-2xl border border-borda p-3"
            >
              <legend className="sr-only">Coluna {ci + 1}</legend>
              <div className="flex items-end gap-1">
                <label className="min-w-0 flex-1 text-xs font-semibold text-suave">
                  Título da coluna {ci + 1}
                  <input
                    className="campo mt-1 text-sm font-normal text-texto"
                    value={c.titulo}
                    maxLength={LIMITES_RODAPE.titulo}
                    placeholder="Ex.: Compatibilidade"
                    onChange={(e) =>
                      mudarColuna(c.id, (x) => ({
                        ...x,
                        titulo: e.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="botao-icone"
                  aria-label={`Mover coluna ${ci + 1} para a esquerda`}
                  disabled={ci === 0}
                  onClick={() => alterar(mover(colunas, ci, -1))}
                >
                  <ArrowLeft className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="botao-icone"
                  aria-label={`Mover coluna ${ci + 1} para a direita`}
                  disabled={ci === colunas.length - 1}
                  onClick={() => alterar(mover(colunas, ci, 1))}
                >
                  <ArrowRight className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="botao-icone hover:text-perigo"
                  aria-label={`Remover coluna ${ci + 1}`}
                  onClick={() => alterar(colunas.filter((x) => x.id !== c.id))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>

              <ul className="space-y-1.5">
                {c.itens.map((i, ii) => (
                  <li
                    key={i.id}
                    className="flex items-center gap-1 rounded-xl bg-fundo px-2.5 py-1.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {i.titulo}
                    </span>
                    <button
                      type="button"
                      className="botao-icone"
                      aria-label={`Subir ${i.titulo}`}
                      disabled={ii === 0}
                      onClick={() =>
                        mudarColuna(c.id, (x) => ({
                          ...x,
                          itens: mover(x.itens, ii, -1),
                        }))
                      }
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="botao-icone"
                      aria-label={`Descer ${i.titulo}`}
                      disabled={ii === c.itens.length - 1}
                      onClick={() =>
                        mudarColuna(c.id, (x) => ({
                          ...x,
                          itens: mover(x.itens, ii, 1),
                        }))
                      }
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="botao-icone"
                      aria-label={`Editar ${i.titulo}`}
                      onClick={() => setModal({ coluna: c.id, item: i })}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="botao-icone hover:text-perigo"
                      aria-label={`Remover ${i.titulo}`}
                      onClick={() =>
                        mudarColuna(c.id, (x) => ({
                          ...x,
                          itens: x.itens.filter((y) => y.id !== i.id),
                        }))
                      }
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="botao h-8 w-full"
                disabled={c.itens.length >= LIMITES_RODAPE.itens}
                onClick={() => setModal({ coluna: c.id })}
              >
                <Plus className="size-4" aria-hidden />
                Adicionar item
              </button>
            </fieldset>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="botao"
          disabled={colunas.length >= LIMITES_RODAPE.colunas}
          onClick={() =>
            alterar([
              ...colunas,
              { id: novoIdDoRodape(), titulo: '', itens: [] },
            ])
          }
        >
          <Plus className="size-4" aria-hidden />
          Adicionar coluna
        </button>
        <button
          type="button"
          className="botao botao-primario"
          disabled={salvando}
          onClick={() => void salvar()}
        >
          {salvando ? 'Salvando…' : 'Salvar rodapé'}
        </button>
        {aoFechar && (
          <button type="button" className="botao" onClick={aoFechar}>
            Fechar
          </button>
        )}
        {vazio && colunas.length > 0 && (
          <span className="text-xs text-suave">
            Colunas sem título e sem itens são descartadas ao salvar.
          </span>
        )}
        {salvo && (
          <span role="status" className="text-sm text-destaque">
            Rodapé salvo.
          </span>
        )}
      </div>
      {erro && (
        <p role="alert" className="text-sm text-perigo">
          {erro}
        </p>
      )}

      {modal && (
        <ModalItemRodape
          key={modal.item?.id ?? 'novo'}
          item={modal.item}
          aoSalvar={salvarItem}
          aoCancelar={() => setModal(null)}
        />
      )}
    </section>
  )
}
