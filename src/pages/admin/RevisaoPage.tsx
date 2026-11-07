import { useMemo, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import {
  clearFlag,
  listArticlesByFlag,
  listArticlesByStatus,
  publishArticle,
  returnToDraft,
  unpublishArticle,
} from '../../services/articles'
import { listAllBlocks } from '../../services/blocks'
import type { Article } from '../../types/content'
import { nomeDaCategoria } from '../../utils/categorias'
import { limparMarcadores, temImagemNaoMigrada } from '../../utils/content'
import {
  caminhoDoBloco,
  rascunhoDoArtigo,
  rotuloDoStatus,
} from '../../utils/revisao'

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`

export function RevisaoPage() {
  const { user } = useAuth()
  const uid = user?.uid ?? ''
  const { dados, erro, carregando, recarregar } = useAsync(async () => {
    const [artigos, blocos, removidos] = await Promise.all([
      listArticlesByStatus('review'),
      listAllBlocks(),
      listArticlesByFlag('origem_removida'),
    ])
    return { artigos, blocos, removidos }
  }, [])
  const [produto, setProduto] = useState('')
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [ocupado, setOcupado] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [falhas, setFalhas] = useState<string[]>([])

  const blocos = useMemo(() => dados?.blocos ?? [], [dados])
  const produtos = blocos
    .filter((b) => b.parentId === null)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const artigos = useMemo(
    () =>
      (dados?.artigos ?? []).filter((a) => !produto || a.productId === produto),
    [dados, produto],
  )
  const todosMarcados =
    artigos.length > 0 && artigos.every((a) => marcados.has(a.id))

  function alternar(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual)
      if (!novo.delete(id)) novo.add(id)
      return novo
    })
  }

  function alternarTodos() {
    setMarcados(todosMarcados ? new Set() : new Set(artigos.map((a) => a.id)))
  }

  async function executar(acao: () => Promise<void>) {
    setOcupado(true)
    setMensagem(null)
    setFalhas([])
    try {
      await acao()
    } finally {
      setOcupado(false)
    }
  }

  const aprovar = (lista: Article[]) =>
    executar(async () => {
      const erros: string[] = []
      let aprovados = 0
      for (const a of lista) {
        try {
          await publishArticle(a, rascunhoDoArtigo(a), uid)
          aprovados++
        } catch (e) {
          erros.push(
            `${a.titulo}: ${e instanceof Error ? e.message : 'não foi possível publicar.'}`,
          )
        }
      }
      setFalhas(erros)
      setMensagem(
        aprovados > 0
          ? `${plural(aprovados, 'artigo publicado', 'artigos publicados')}.`
          : null,
      )
      setMarcados(new Set())
      recarregar()
    })

  const devolver = (a: Article) =>
    executar(async () => {
      try {
        await returnToDraft(a.id, uid)
        setMensagem(`"${a.titulo}" voltou para rascunho.`)
      } catch (e) {
        setFalhas([
          e instanceof Error ? e.message : 'Não foi possível devolver.',
        ])
      }
      recarregar()
    })

  const manterRemovido = (a: Article) =>
    executar(async () => {
      try {
        await clearFlag(a.id, 'origem_removida', uid)
        setMensagem(`"${a.titulo}" continua no ar; o aviso foi dispensado.`)
      } catch (e) {
        setFalhas([
          e instanceof Error ? e.message : 'Não foi possível dispensar.',
        ])
      }
      recarregar()
    })

  const despublicarRemovido = (a: Article) =>
    executar(async () => {
      try {
        if (a.status === 'published') await unpublishArticle(a.id, uid)
        await clearFlag(a.id, 'origem_removida', uid)
        setMensagem(`"${a.titulo}" foi despublicado (voltou para rascunho).`)
      } catch (e) {
        setFalhas([
          e instanceof Error ? e.message : 'Não foi possível despublicar.',
        ])
      }
      recarregar()
    })

  const selecionados = artigos.filter((a) => marcados.has(a.id))

  return (
    <div>
      <PageHeader
        icone={ClipboardCheck}
        titulo="Fila de revisão"
        subtitulo={
          dados
            ? `${plural(dados.artigos.length, 'artigo aguardando', 'artigos aguardando')} aprovação. Nada aqui aparece para os leitores.`
            : undefined
        }
      />

      {carregando && !dados && <p className="text-suave">Carregando…</p>}
      {erro && (
        <p role="alert" className="text-perigo">
          {erro}
        </p>
      )}
      {mensagem && (
        <p role="status" className="mb-4 text-sm text-sucesso">
          {mensagem}
        </p>
      )}
      {falhas.length > 0 && (
        <div role="alert" className="mb-4 text-sm text-perigo">
          <p>Não foi possível concluir:</p>
          <ul className="list-disc pl-5">
            {falhas.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {dados && dados.removidos.length > 0 && (
        <section
          aria-label="Arquivos removidos na origem"
          className="mb-8 rounded-lg border border-ambar/40 bg-ambar-fundo p-4"
        >
          <h2 className="font-semibold text-ambar">
            Arquivo removido na origem ({dados.removidos.length})
          </h2>
          <p className="mb-3 text-sm text-suave">
            O arquivo que gerou estes artigos sumiu da pasta de origem. Nada foi
            despublicado: decida o que fazer com cada um.
          </p>
          <ul className="space-y-2">
            {dados.removidos.map((a) => (
              <li key={a.id} className="cartao flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/admin/artigos/${a.id}/editar`}
                    className="font-medium hover:underline"
                  >
                    {a.titulo}
                  </Link>
                  <p className="text-xs text-suave">
                    {a.origem?.arquivo ?? caminhoDoBloco(blocos, a.blockId)} ·{' '}
                    {rotuloDoStatus(a.status)}
                  </p>
                </div>
                <button
                  type="button"
                  className="botao"
                  disabled={ocupado}
                  onClick={() => void manterRemovido(a)}
                >
                  Manter
                </button>
                <button
                  type="button"
                  className="botao"
                  disabled={ocupado}
                  onClick={() => void despublicarRemovido(a)}
                >
                  {a.status === 'published' ? 'Despublicar' : 'Dispensar'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dados && dados.artigos.length === 0 && (
        <p className="text-suave">
          Nenhum artigo na fila. Os importados e os enviados para revisão no
          editor aparecem aqui.
        </p>
      )}

      {dados && dados.artigos.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={todosMarcados}
                onChange={alternarTodos}
              />
              Selecionar todos
            </label>
            <select
              aria-label="Filtrar por produto"
              className="campo w-auto"
              value={produto}
              onChange={(e) => {
                setProduto(e.target.value)
                setMarcados(new Set())
              }}
            >
              <option value="">Todos os produtos</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="botao botao-primario"
              disabled={ocupado || selecionados.length === 0}
              onClick={() => void aprovar(selecionados)}
            >
              {ocupado
                ? 'Publicando…'
                : `Aprovar e publicar selecionados (${selecionados.length})`}
            </button>
          </div>

          <ul className="space-y-3">
            {artigos.map((a) => {
              const resumo = limparMarcadores(a.resumo)
              const categoria = nomeDaCategoria(a.categoria)
              return (
                <li key={a.id} className="cartao flex gap-3 p-4">
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${a.titulo}`}
                    className="mt-1"
                    checked={marcados.has(a.id)}
                    onChange={() => alternar(a.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/admin/artigos/${a.id}/editar`}
                        className="font-semibold hover:underline"
                      >
                        {a.titulo}
                      </Link>
                      {a.origem?.tipo === 'importacao' && (
                        <span className="selo">Importado</span>
                      )}
                      {categoria && <span className="selo">{categoria}</span>}
                      {a.publico === 'tecnico' && (
                        <span className="selo">Técnico</span>
                      )}
                      {temImagemNaoMigrada(a.textoPlano ?? '') && (
                        <span className="selo selo-ambar">
                          Imagem não migrada
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-suave">
                      {caminhoDoBloco(blocos, a.blockId)}
                      {a.origem?.arquivo && ` · ${a.origem.arquivo}`}
                    </p>
                    {a.origem?.classificacao && (
                      <p className="text-xs text-suave">
                        Categoria e público sugeridos automaticamente (
                        {a.origem.classificacao.conteudo}, confiança{' '}
                        {a.origem.classificacao.confianca}): confira antes de
                        aprovar.
                      </p>
                    )}
                    {resumo && (
                      <p className="mt-1 line-clamp-2 text-sm text-suave">
                        {resumo}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-start gap-2">
                    <Link
                      to={`/admin/artigos/${a.id}/editar`}
                      className="botao"
                    >
                      Revisar
                    </Link>
                    <button
                      type="button"
                      className="botao"
                      disabled={ocupado}
                      onClick={() => void aprovar([a])}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      className="botao"
                      disabled={ocupado}
                      onClick={() => void devolver(a)}
                    >
                      Devolver
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
