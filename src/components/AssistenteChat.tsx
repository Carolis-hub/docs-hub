import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Search, Send, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { useSearchEngine } from '../hooks/useSearchEngine'
import {
  assistenteConfigurado,
  avaliarResposta,
  perguntar,
} from '../services/assistente'
import { listProductTree } from '../services/blocks'
import type {
  AvaliacaoResposta,
  FiltrosAssistente,
  FonteResposta,
  RespostaAssistente,
} from '../types/assistente'
import type { CategoriaId } from '../types/content'
import { CATEGORIAS } from '../utils/categorias'
import { consultarSemIA, type ResultadoSemIA } from '../utils/consultaSemIA'
import { lerResposta, type Trecho } from '../utils/markdownSimples'
import { Highlight } from './Highlight'

type Mensagem =
  | { id: number; papel: 'usuario'; texto: string }
  | {
      id: number
      papel: 'assistente'
      texto: string
      resposta: RespostaAssistente
      avaliacao?: AvaliacaoResposta
    }
  /** Consulta sem a IA: os artigos que a busca achou para a pergunta. */
  | { id: number; papel: 'busca'; resultados: ResultadoSemIA[] }

const campo = 'campo h-10'
const SEM_UNIDADE = 'sem-unidade'

function Trechos({
  trechos,
  fontes,
}: {
  trechos: Trecho[]
  fontes: FonteResposta[]
}) {
  return (
    <>
      {trechos.map((t, i) => {
        if (t.tipo === 'negrito') return <strong key={i}>{t.texto}</strong>
        if (t.tipo === 'codigo') {
          return (
            <code key={i} className="rounded bg-bloco px-1 text-[0.9em]">
              {t.texto}
            </code>
          )
        }
        if (t.tipo === 'citacao') {
          const fonte = fontes.find((f) => f.numero === t.numero)
          return fonte ? (
            <Link
              key={i}
              to={`/a/${fonte.id}`}
              title={fonte.titulo}
              className="mx-0.5 align-super text-xs font-medium text-bloco-icone hover:underline"
            >
              [{t.numero}]
            </Link>
          ) : (
            <span key={i} className="align-super text-xs text-suave">
              [{t.numero}]
            </span>
          )
        }
        return <span key={i}>{t.texto}</span>
      })}
    </>
  )
}

function TextoDaResposta({
  texto,
  fontes,
}: {
  texto: string
  fontes: FonteResposta[]
}) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lerResposta(texto).map((b, i) =>
        b.tipo === 'paragrafo' ? (
          <p key={i}>
            <Trechos trechos={b.trechos} fontes={fontes} />
          </p>
        ) : b.ordenada ? (
          <ol key={i} className="list-decimal space-y-1 pl-5">
            {b.itens.map((item, j) => (
              <li key={j}>
                <Trechos trechos={item} fontes={fontes} />
              </li>
            ))}
          </ol>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.itens.map((item, j) => (
              <li key={j}>
                <Trechos trechos={item} fontes={fontes} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  )
}

/**
 * Conversa com o assistente (filtros, mensagens e caixa de pergunta). Usada na
 * página do Assistente e no painel lateral. `compacto` recolhe os filtros.
 */
export function AssistenteChat({ compacto = false }: { compacto?: boolean }) {
  const { dados } = useSearchEngine()
  const [unidade, setUnidade] = useState('')
  const [produto, setProduto] = useState('')
  const [subproduto, setSubproduto] = useState('')
  const [categoria, setCategoria] = useState<CategoriaId | ''>('')
  const [texto, setTexto] = useState('')
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [restantes, setRestantes] = useState<number | null>(null)
  const proximoId = useRef(1)
  /** O servidor não respondeu nesta sessão: avisa que a consulta está sem IA. */
  const [semServidor, setSemServidor] = useState(false)
  const comIA = assistenteConfigurado()

  const produtos = useMemo(() => dados?.produtos ?? [], [dados])
  const unidades = useMemo(() => dados?.unidades ?? [], [dados])
  const idsDeUnidades = new Set(unidades.map((u) => u.id))
  const semUnidade = (p: { unidadeId?: string | null }) =>
    !p.unidadeId || !idsDeUnidades.has(p.unidadeId)
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

  const { dados: arvore } = useAsync(
    async () => (produto ? await listProductTree(produto) : []),
    [produto],
  )
  const subprodutos = (arvore ?? [])
    .filter((b) => b.parentId === produto)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))

  const filtros = (): FiltrosAssistente => ({
    ...(unidade && unidade !== SEM_UNIDADE ? { unidadeId: unidade } : {}),
    ...(produto ? { produtoId: produto } : {}),
    ...(subproduto ? { subprodutoId: subproduto } : {}),
    ...(categoria ? { categoria } : {}),
  })

  /** Consulta sem a IA: lista os artigos achados pela busca. `false` se a busca ainda não carregou. */
  function consultarLocal(pergunta: string): boolean {
    if (!dados?.motor) {
      setErro('A busca ainda está carregando. Tente de novo em instantes.')
      return false
    }
    const descendentes = new Set<string>()
    if (subproduto) {
      descendentes.add(subproduto)
      let cresceu = true
      while (cresceu) {
        cresceu = false
        for (const b of arvore ?? []) {
          if (
            b.parentId &&
            descendentes.has(b.parentId) &&
            !descendentes.has(b.id)
          ) {
            descendentes.add(b.id)
            cresceu = true
          }
        }
      }
    }
    const resultados = consultarSemIA(dados.motor, pergunta, {
      ...(produto ? { productId: produto } : {}),
      ...(!produto && unidade
        ? { productIds: produtosDoFiltro.map((p) => p.id) }
        : {}),
      ...(subproduto ? { blockIds: descendentes } : {}),
      ...(categoria ? { categoria } : {}),
    })
    setMensagens((atual) => [
      ...atual,
      { id: proximoId.current++, papel: 'busca', resultados },
    ])
    return true
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const pergunta = texto.trim()
    if (pergunta.length < 3 || enviando) return
    const historico = mensagens
      .flatMap((m) =>
        m.papel === 'busca' ? [] : [{ papel: m.papel, texto: m.texto }],
      )
      .slice(-6)
    setMensagens((atual) => [
      ...atual,
      { id: proximoId.current++, papel: 'usuario', texto: pergunta },
    ])
    setTexto('')
    setErro(null)
    // Sem o servidor do assistente, a consulta é feita direto na busca.
    if (!comIA) {
      consultarLocal(pergunta)
      return
    }
    setEnviando(true)
    try {
      const resposta = await perguntar({
        pergunta,
        historico,
        filtros: filtros(),
      })
      setRestantes(resposta.restantesHoje)
      setMensagens((atual) => [
        ...atual,
        {
          id: proximoId.current++,
          papel: 'assistente',
          texto: resposta.resposta,
          resposta,
        },
      ])
    } catch (e) {
      // Servidor fora do ar: em vez de só avisar, mostra o que a busca achou.
      if (
        (e as { codigo?: string }).codigo === 'rede' &&
        consultarLocal(pergunta)
      ) {
        setSemServidor(true)
      } else {
        setErro(
          e instanceof Error ? e.message : 'Não foi possível responder agora.',
        )
      }
    } finally {
      setEnviando(false)
    }
  }

  async function avaliar(id: number, logId: string, valor: AvaliacaoResposta) {
    setMensagens((atual) =>
      atual.map((m) =>
        m.id === id && m.papel === 'assistente'
          ? { ...m, avaliacao: valor }
          : m,
      ),
    )
    try {
      await avaliarResposta(logId, valor)
    } catch {
      // A avaliação é opcional: se falhar, a conversa segue.
    }
  }

  const filtrosUi = (
    <div
      className="mb-4 flex flex-wrap gap-2"
      role="group"
      aria-label="Limitar a pergunta"
    >
      {unidadesVisiveis.length > 0 && (
        <select
          aria-label="Limitar por unidade de negócio"
          className={campo}
          value={unidade}
          onChange={(e) => {
            setUnidade(e.target.value)
            setProduto('')
            setSubproduto('')
          }}
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
        aria-label="Limitar por produto"
        className={campo}
        value={produto}
        onChange={(e) => {
          setProduto(e.target.value)
          setSubproduto('')
        }}
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
          aria-label="Limitar por subproduto"
          className={campo}
          value={subproduto}
          onChange={(e) => setSubproduto(e.target.value)}
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
        aria-label="Limitar por categoria"
        className={campo}
        value={categoria}
        onChange={(e) => setCategoria(e.target.value as CategoriaId | '')}
      >
        <option value="">Todas as categorias</option>
        {CATEGORIAS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <div>
      {compacto ? (
        <details className="mb-4 text-sm">
          <summary className="cursor-pointer text-suave hover:text-texto">
            Limitar a pergunta
          </summary>
          <div className="mt-2">{filtrosUi}</div>
        </details>
      ) : (
        filtrosUi
      )}

      {(!comIA || semServidor) && (
        <p role="status" className="mb-4 rounded-xl bg-fundo p-3 text-sm">
          {comIA
            ? 'Não consegui falar com o assistente de IA. Enquanto isso, a consulta mostra os artigos encontrados pela busca.'
            : 'Consulta sem IA: o assistente não está configurado neste ambiente, então a pergunta é procurada direto na documentação.'}
        </p>
      )}

      <ul className="mb-4 space-y-3" aria-live="polite" aria-label="Conversa">
        {mensagens.length === 0 && (
          <li className="text-sm text-suave">
            Exemplo: “Como configuro o envio de e-mail no SmartShare?”
          </li>
        )}
        {mensagens.map((m) =>
          m.papel === 'usuario' ? (
            <li
              key={m.id}
              className="ml-auto max-w-[85%] rounded-lg bg-bloco p-3 text-sm"
            >
              {m.texto}
            </li>
          ) : m.papel === 'busca' ? (
            <li key={m.id} className="cartao max-w-[95%] p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-suave">
                <Search className="size-3.5" aria-hidden />
                Consulta sem IA: artigos encontrados na documentação
              </p>
              {m.resultados.length === 0 ? (
                <p className="text-sm">
                  Não encontrei artigos sobre isso. Tente outras palavras ou
                  tire os filtros.
                </p>
              ) : (
                <ol className="space-y-3 text-sm">
                  {m.resultados.map((r) => (
                    <li key={r.item.id}>
                      <Link
                        to={`/a/${r.item.id}`}
                        className="font-semibold text-bloco-icone hover:underline"
                      >
                        {r.item.titulo}
                      </Link>
                      <span className="text-xs text-suave">
                        {' · '}
                        {produtos.find((p) => p.id === r.item.productId)
                          ?.nome ?? 'Produto'}
                      </span>
                      <p className="mt-0.5 text-suave">
                        <Highlight partes={r.trecho} />
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ) : (
            <li key={m.id} className="cartao max-w-[95%] p-4">
              {!m.resposta.encontrou && (
                <p className="mb-2 text-xs font-medium text-ambar">
                  Não encontrei a resposta na documentação
                </p>
              )}
              <TextoDaResposta texto={m.texto} fontes={m.resposta.fontes} />
              {m.resposta.fontes.length > 0 && (
                <div className="mt-3 border-t border-borda pt-2 text-xs text-suave">
                  <p className="mb-1 font-medium">Fontes</p>
                  <ul className="space-y-0.5">
                    {m.resposta.fontes.map((f) => (
                      <li key={f.id}>
                        [{f.numero}]{' '}
                        <Link
                          to={`/a/${f.id}`}
                          className="text-bloco-icone hover:underline"
                        >
                          {f.titulo}
                        </Link>{' '}
                        · {f.produto}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-3 flex items-center gap-2 text-xs text-suave">
                {m.avaliacao ? (
                  <span role="status">Obrigado pela avaliação.</span>
                ) : (
                  <>
                    <span>A resposta ajudou?</span>
                    <button
                      type="button"
                      className="botao"
                      aria-label="Resposta útil"
                      onClick={() =>
                        void avaliar(m.id, m.resposta.logId, 'util')
                      }
                    >
                      <ThumbsUp className="size-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="botao"
                      aria-label="Resposta ruim"
                      onClick={() =>
                        void avaliar(m.id, m.resposta.logId, 'ruim')
                      }
                    >
                      <ThumbsDown className="size-3.5" aria-hidden />
                    </button>
                  </>
                )}
              </div>
            </li>
          ),
        )}
        {enviando && (
          <li className="text-sm text-suave" role="status">
            Procurando na documentação…
          </li>
        )}
      </ul>

      {erro && (
        <p role="alert" className="mb-3 text-sm text-perigo">
          {erro}
        </p>
      )}

      <form onSubmit={(e) => void enviar(e)} className="space-y-2">
        <textarea
          aria-label="Sua pergunta"
          className="campo"
          rows={3}
          maxLength={1000}
          value={texto}
          disabled={enviando}
          placeholder="Escreva sua pergunta…"
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-suave">
            {restantes !== null &&
              `${restantes} pergunta${restantes === 1 ? '' : 's'} restante${restantes === 1 ? '' : 's'} hoje. `}
            {comIA && !semServidor
              ? 'A IA pode errar: confira nas fontes.'
              : 'Sem IA: a consulta lista os artigos, sem escrever uma resposta.'}
          </p>
          <button
            type="submit"
            className="botao botao-primario"
            disabled={enviando || texto.trim().length < 3}
          >
            <Send className="size-4" aria-hidden />
            Perguntar
          </button>
        </div>
      </form>
    </div>
  )
}
