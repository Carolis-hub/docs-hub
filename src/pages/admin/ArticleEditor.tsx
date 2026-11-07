import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { JSONContent } from '@tiptap/react'
import { RichEditor } from '../../components/editor/RichEditor'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { listarAuditoriaDoArtigo } from '../../services/audit'
import {
  clearFlag,
  createArticle,
  deleteArticle,
  getArticle,
  listVersions,
} from '../../services/articles'
import { getBlock } from '../../services/blocks'
import {
  adicionarComentario,
  listarComentarios,
} from '../../services/comentarios'
import {
  descartarRevisao,
  getRevisao,
  salvarAlteracoes,
  transitar,
} from '../../services/governanca'
import { getSuggestion } from '../../services/suggestions'
import { listUsers } from '../../services/users'
import type {
  Article,
  ArticleDraft,
  ArticlePublico,
  ArticleVersion,
  CategoriaId,
  Comentario,
  Revisao,
  Suggestion,
} from '../../types/content'
import { rotuloDaAuditoria } from '../../utils/auditoria'
import { CATEGORIAS } from '../../utils/categorias'
import {
  acoesDisponiveis,
  exigeComentario,
  rotuloDaAcao,
  type AcaoCiclo,
} from '../../utils/ciclo'
import { EMPTY_DOC } from '../../utils/content'
import { rotuloDoStatus } from '../../utils/revisao'

const campo =
  'mt-1 w-full rounded-md border border-borda bg-cartao px-3 py-2 text-sm  '
const botaoSec =
  'rounded-md border border-borda px-3 py-1.5 text-sm disabled:opacity-50 '
const botaoPrimario =
  'rounded-md bg-destaque px-3 py-1.5 text-sm font-medium text-white hover:bg-destaque/90 disabled:opacity-50'

const ACOES_DO_ARTIGO: AcaoCiclo[] = ['despublicar', 'arquivar', 'restaurar']

const TIPO_COMENTARIO: Record<Comentario['tipo'], string> = {
  comentario: 'Comentário',
  ajuste: 'Pedido de ajuste',
  reprovacao: 'Reprovação',
  aprovacao: 'Aprovação',
}

export function ArticleEditor() {
  const { articleId } = useParams()
  const [params] = useSearchParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const uid = user?.uid ?? ''
  const autorNome = profile?.nome || user?.email || uid

  const { dados, erro, carregando, recarregar } = useAsync(async () => {
    if (articleId) {
      const artigo = await getArticle(articleId)
      if (!artigo) return null
      const sugestaoId = params.get('sugestao')
      const [revisao, versoes, comentarios, trilha, sugestao, usuarios] =
        await Promise.all([
          artigo.revisao ? getRevisao(artigo.id) : Promise.resolve(null),
          listVersions(artigo.id),
          listarComentarios(artigo.id).catch(() => [] as Comentario[]),
          // A trilha depende de um índice do Firestore: sem ele, o editor segue sem ela.
          listarAuditoriaDoArtigo(artigo.id).catch(() => []),
          sugestaoId
            ? getSuggestion(artigo.id, sugestaoId)
            : Promise.resolve(null),
          listUsers().catch(() => []),
        ])
      return {
        artigo,
        revisao,
        versoes,
        comentarios,
        trilha,
        sugestao,
        usuarios,
      }
    }
    return {
      artigo: null as Article | null,
      revisao: null as Revisao | null,
      versoes: [] as ArticleVersion[],
      comentarios: [] as Comentario[],
      trilha: [] as Awaited<ReturnType<typeof listarAuditoriaDoArtigo>>,
      sugestao: null as Suggestion | null,
      usuarios: [] as Awaited<ReturnType<typeof listUsers>>,
    }
  }, [articleId, params])

  const [titulo, setTitulo] = useState('')
  const [publico, setPublico] = useState<ArticlePublico>('usuario')
  const [categoria, setCategoria] = useState<CategoriaId | ''>('')
  const [versaoProduto, setVersaoProduto] = useState('')
  const [conteudo, setConteudo] = useState<JSONContent>(EMPTY_DOC)
  const [editorKey, setEditorKey] = useState(0)
  const [baseline, setBaseline] = useState('')
  const [comentario, setComentario] = useState('')
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [falha, setFalha] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const artigo = dados?.artigo ?? null
  const revisao = dados?.revisao ?? null
  const sugestao = dados?.sugestao ?? null
  const sugestaoPendente = sugestao?.status === 'pending' ? sugestao : null

  useEffect(() => {
    if (!artigo) return
    // O documento de trabalho é a alteração pendente, se houver, ou o próprio artigo.
    const base = revisao ?? artigo
    let t = base.titulo
    let c = base.conteudo
    // Vindo da revisão de uma sugestão, o editor abre com o texto proposto.
    if (sugestaoPendente && !revisao) {
      t = sugestaoPendente.titulo
      c = sugestaoPendente.conteudo
    }
    setTitulo(t)
    setPublico(base.publico)
    setCategoria(base.categoria ?? '')
    setVersaoProduto(base.versaoProduto ?? '')
    setConteudo(c)
    setBaseline(
      JSON.stringify([
        base.titulo,
        base.publico,
        base.categoria ?? '',
        base.versaoProduto ?? '',
        base.conteudo,
      ]),
    )
    setEditorKey((k) => k + 1)
  }, [artigo, revisao, sugestaoPendente])

  const nomes = useMemo(
    () => new Map((dados?.usuarios ?? []).map((u) => [u.uid, u.nome])),
    [dados],
  )
  const nomeDe = (id?: string) => (id ? (nomes.get(id) ?? id.slice(0, 6)) : '—')

  if (carregando && !dados) return <p className="text-suave">Carregando…</p>
  if (erro)
    return (
      <p role="alert" className="text-perigo ">
        {erro}
      </p>
    )
  if (articleId && !artigo) return <p>Artigo não encontrado.</p>

  const draft = (): ArticleDraft => ({
    titulo,
    conteudo,
    publico,
    categoria,
    versaoProduto,
  })
  const sujo =
    !!artigo &&
    JSON.stringify([titulo, publico, categoria, versaoProduto, conteudo]) !==
      baseline

  const publicado = artigo?.status === 'published'
  const estadoDeTrabalho = revisao?.status ?? artigo?.status ?? 'draft'
  const acoes = artigo
    ? acoesDisponiveis(estadoDeTrabalho, { revisao: !!revisao })
    : []

  async function executar(acao: () => Promise<string | void>) {
    setOcupado(true)
    setFalha(null)
    setMensagem(null)
    try {
      const resultado = await acao()
      if (resultado) setMensagem(resultado)
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não foi possível concluir.')
    } finally {
      setOcupado(false)
    }
  }

  const salvar = () =>
    executar(async () => {
      if (artigo) {
        const { alvo } = await salvarAlteracoes(artigo.id, draft(), uid, {
          sugestaoId: sugestaoPendente?.id,
        })
        recarregar()
        return alvo === 'revisao'
          ? 'Alteração salva. A versão publicada continua no ar até esta ser aprovada e publicada.'
          : 'Alterações salvas.'
      }
      const blockId = params.get('blockId')
      const bloco = blockId ? await getBlock(blockId) : null
      if (!bloco) throw new Error('Bloco de destino não encontrado.')
      const id = await createArticle(draft(), bloco.id, bloco.productId, uid)
      navigate(`/admin/artigos/${id}/editar`, { replace: true })
    })

  const aplicar = (acao: AcaoCiclo) =>
    executar(async () => {
      if (!artigo) return
      if (exigeComentario(acao) && !comentario.trim()) {
        throw new Error(
          'Explique o que precisa ser ajustado antes de reprovar.',
        )
      }
      const doArtigo = ACOES_DO_ARTIGO.includes(acao)
      if (sujo && !doArtigo) {
        if (acao === 'publicar') {
          throw new Error(
            'Há alterações não salvas. Salve primeiro: editar depois da aprovação anula a aprovação, e será preciso aprovar de novo.',
          )
        }
        await salvarAlteracoes(artigo.id, draft(), uid, {
          sugestaoId: sugestaoPendente?.id,
        })
      }
      const r = await transitar(artigo.id, acao, uid, {
        comentario,
        autorNome,
        sugestaoId: sugestaoPendente?.id,
      })
      setComentario('')
      recarregar()
      return acao === 'publicar'
        ? `Publicado (versão ${r.versao}).`
        : `${rotuloDaAcao(acao)}: feito.`
    })

  const comentar = () =>
    executar(async () => {
      if (!artigo) return
      await adicionarComentario(
        artigo.id,
        { texto: comentario, alvo: revisao ? 'revisao' : 'artigo' },
        uid,
        autorNome,
      )
      setComentario('')
      recarregar()
      return 'Comentário registrado.'
    })

  const descartar = () =>
    executar(async () => {
      if (
        !artigo ||
        !window.confirm(
          'Descartar a alteração pendente? A versão publicada não muda.',
        )
      )
        return
      await descartarRevisao(artigo.id, uid)
      recarregar()
      return 'Alteração pendente descartada.'
    })

  const limparPrints = () =>
    executar(async () => {
      if (!artigo) return
      await clearFlag(artigo.id, 'prints_desatualizados', uid)
      recarregar()
      return 'Alerta de prints removido.'
    })

  const excluir = () =>
    executar(async () => {
      if (!artigo || !window.confirm('Excluir este artigo e suas versões?'))
        return
      await deleteArticle(artigo.id, uid)
      navigate(`/b/${artigo.blockId}`, { replace: true })
    })

  function restaurar(v: ArticleVersion) {
    if (!window.confirm(`Carregar a versão ${v.versao} no editor?`)) return
    setTitulo(v.titulo)
    setConteudo(v.conteudo)
    setEditorKey((k) => k + 1)
    setMensagem(
      publicado
        ? `Versão ${v.versao} carregada. Salve para criar uma alteração pendente com ela.`
        : `Versão ${v.versao} carregada. Salve para confirmar a restauração.`,
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-2xl font-semibold">
        {artigo ? 'Editar artigo' : 'Novo artigo'}
        {artigo && (
          <span className="ml-3 rounded bg-bloco px-2 py-0.5 text-xs font-normal ">
            {publicado
              ? `Publicado v${artigo.versao}`
              : rotuloDoStatus(artigo.status)}
          </span>
        )}
        {revisao && (
          <span className="ml-2 rounded bg-ambar-fundo px-2 py-0.5 text-xs font-normal text-ambar">
            Alteração pendente: {rotuloDoStatus(revisao.status)}
          </span>
        )}
      </h1>

      {publicado && !revisao && (
        <p
          role="note"
          className="mb-4 rounded-md bg-bloco p-3 text-sm text-texto"
        >
          Este artigo está publicado. Ao salvar, suas mudanças ficam numa{' '}
          <strong>alteração pendente</strong>: a versão publicada continua no ar
          até a alteração ser aprovada e publicada.
        </p>
      )}
      {revisao && (
        <div
          role="note"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-ambar-fundo p-3 text-sm text-ambar"
        >
          <span>
            Você está editando a alteração pendente (
            {rotuloDoStatus(revisao.status).toLowerCase()}). A versão{' '}
            {artigo?.versao} continua no ar.
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-ambar/50 px-2 py-1"
              onClick={() => navigate(`/a/${artigo?.id}`)}
            >
              Ver a versão publicada
            </button>
            <button
              type="button"
              disabled={ocupado}
              className="rounded-md border border-ambar/50 px-2 py-1"
              onClick={() => void descartar()}
            >
              Descartar alteração
            </button>
          </span>
        </div>
      )}
      {sugestaoPendente && (
        <p
          role="status"
          className="mb-4 rounded-md bg-bloco p-3 text-sm text-texto "
        >
          {sugestaoPendente.origem.tipo === 'ingestao'
            ? 'Editando a partir da atualização do arquivo'
            : 'Editando a partir da sugestão da IA'}{' '}
          ({sugestaoPendente.origem.arquivo}).{' '}
          {publicado
            ? 'Salvar cria uma alteração pendente; a sugestão é aprovada quando ela for publicada.'
            : 'A sugestão é aprovada quando o artigo for publicado.'}
        </p>
      )}
      {artigo?.flags.includes('prints_desatualizados') && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-ambar-fundo p-3 text-sm text-ambar "
        >
          <span>Os prints deste artigo podem estar desatualizados.</span>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void limparPrints()}
            className="rounded-md border border-ambar/50 px-2 py-1"
          >
            Prints atualizados
          </button>
        </div>
      )}

      <div className="space-y-4">
        <label className="block text-sm">
          Título
          <input
            className={campo}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            Categoria
            <select
              className={campo}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaId | '')}
            >
              <option value="">Sem categoria</option>
              {CATEGORIAS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Público
            <select
              className={campo}
              value={publico}
              onChange={(e) => setPublico(e.target.value as ArticlePublico)}
            >
              <option value="usuario">Usuário</option>
              <option value="tecnico">Técnico</option>
            </select>
          </label>
          <label className="block text-sm">
            Versão do produto (opcional)
            <input
              className={campo}
              value={versaoProduto}
              onChange={(e) => setVersaoProduto(e.target.value)}
            />
          </label>
        </div>

        <RichEditor key={editorKey} value={conteudo} onChange={setConteudo} />

        {artigo && (
          <label className="block text-sm">
            Comentário da revisão
            <textarea
              className={campo}
              rows={2}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Obrigatório para reprovar (diga o que ajustar). Nas outras ações é opcional."
            />
          </label>
        )}

        {falha && (
          <p role="alert" className="text-sm text-perigo ">
            {falha}
          </p>
        )}
        {mensagem && (
          <p role="status" className="text-sm text-sucesso ">
            {mensagem}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={ocupado || (!!artigo && !sujo && !sugestaoPendente)}
            onClick={() => void salvar()}
            className={botaoPrimario}
          >
            {!artigo
              ? 'Criar rascunho'
              : publicado
                ? 'Salvar como alteração pendente'
                : 'Salvar'}
          </button>
          {artigo &&
            acoes.map((acao) => (
              <button
                key={acao}
                type="button"
                disabled={ocupado}
                onClick={() => void aplicar(acao)}
                className={acao === 'publicar' ? botaoPrimario : botaoSec}
              >
                {rotuloDaAcao(acao)}
              </button>
            ))}
          {artigo && (
            <>
              <button
                type="button"
                disabled={ocupado || !comentario.trim()}
                onClick={() => void comentar()}
                className={botaoSec}
              >
                Só comentar
              </button>
              <button
                type="button"
                className={botaoSec}
                onClick={() => navigate(`/a/${artigo.id}`)}
              >
                Ver artigo
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void excluir()}
                className="rounded-md border border-perigo/40 px-3 py-1.5 text-sm text-perigo disabled:opacity-50 "
              >
                Excluir
              </button>
            </>
          )}
        </div>
      </div>

      {dados && dados.comentarios.length > 0 && (
        <section className="mt-10" aria-label="Comentários da revisão">
          <h2 className="mb-3 text-lg font-semibold">Comentários da revisão</h2>
          <ul className="space-y-2">
            {dados.comentarios.map((c) => (
              <li key={c.id} className="cartao p-3 text-sm">
                <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-suave">
                  <span className="selo">{TIPO_COMENTARIO[c.tipo]}</span>
                  {c.alvo === 'revisao' && (
                    <span className="selo">Alteração pendente</span>
                  )}
                  <span>
                    {c.autorNome} ·{' '}
                    {new Date(c.criadoEm).toLocaleString('pt-BR')}
                  </span>
                </p>
                <p className="whitespace-pre-wrap">{c.texto}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dados && dados.versoes.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Histórico de versões</h2>
          <ul className="divide-y divide-borda rounded-lg border border-borda bg-cartao ">
            {dados.versoes.map((v) => (
              <li
                key={v.versao}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
              >
                <span>
                  Versão {v.versao} ·{' '}
                  {new Date(v.criadoEm).toLocaleString('pt-BR')} ·{' '}
                  {v.origem === 'ia' ? 'IA' : 'manual'}
                  {v.aprovadoPor && ` · aprovada por ${nomeDe(v.aprovadoPor)}`}
                  {` · publicada por ${nomeDe(v.autorId)}`}
                </span>
                <button
                  type="button"
                  className={botaoSec}
                  onClick={() => restaurar(v)}
                >
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dados && dados.trilha.length > 0 && (
        <section className="mt-10" aria-label="Trilha de auditoria">
          <h2 className="mb-3 text-lg font-semibold">Trilha de auditoria</h2>
          <ul className="divide-y divide-borda rounded-lg border border-borda bg-cartao text-sm">
            {dados.trilha.map((t) => (
              <li key={t.id} className="px-4 py-2">
                <span className="text-suave">
                  {new Date(t.data).toLocaleString('pt-BR')}
                </span>{' '}
                · <strong>{nomeDe(t.usuarioId)}</strong> ·{' '}
                {rotuloDaAuditoria(t.acao)}
                {t.detalhe && (
                  <span className="text-suave"> ({t.detalhe})</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
