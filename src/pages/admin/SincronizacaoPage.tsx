import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { useAsync } from '../../hooks/useAsync'
import { listarSincronizacoes } from '../../services/sincronizacao'
import {
  DIAS_SEM_SINCRONIZAR,
  ROTULO_SITUACAO,
  haQuantoTempo,
  ordenarFontes,
  situacaoDaFonte,
  type SituacaoFonte,
} from '../../utils/sincronizacao'

const MODO = { manual: 'Manual', observar: 'Vigiando a pasta', git: 'Git' }

const SELO: Record<SituacaoFonte, string> = {
  'com-erros': 'selo selo-ambar',
  desatualizada: 'selo selo-ambar',
  'em-dia': 'selo',
}

/** Painel das fontes de documentos: quando foram conferidas, o que mudou e o que deu erro. */
export function SincronizacaoPage() {
  const { dados, erro, carregando, recarregar } = useAsync(
    listarSincronizacoes,
    [],
  )
  const agora = Date.now()
  const fontes = useMemo(() => ordenarFontes(dados ?? [], Date.now()), [dados])

  return (
    <div>
      <PageHeader
        icone={RefreshCw}
        titulo="Sincronização"
        subtitulo="Pastas e repositórios de onde vêm os documentos. Nada é publicado sozinho: o que muda vai para a fila de revisão."
        acoes={
          <button type="button" className="botao" onClick={recarregar}>
            Atualizar
          </button>
        }
      />

      {carregando && !dados && <p className="text-suave">Carregando…</p>}
      {erro && (
        <p role="alert" className="text-perigo">
          {erro}
        </p>
      )}
      {dados && fontes.length === 0 && (
        <p className="text-suave">
          Nenhuma fonte sincronizada ainda. Rode{' '}
          <code>npm run ingestao -- &lt;pasta&gt; --produto … --gravar</code>{' '}
          (veja <code>scripts/ingestao/README.md</code>).
        </p>
      )}

      <ul className="space-y-4">
        {fontes.map((f) => {
          const situacao = situacaoDaFonte(f, agora)
          const r = f.resumo
          return (
            <li key={f.fonteId} aria-label={f.fonteId} className="cartao p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{f.fonteId}</h2>
                <span className={SELO[situacao]}>
                  {ROTULO_SITUACAO[situacao]}
                </span>
                <span className="selo">{MODO[f.modo] ?? f.modo}</span>
              </div>
              <p className="mt-1 text-sm text-suave">
                Produto: {f.produtoNome} · conferida{' '}
                {haQuantoTempo(f.ultimaExecucao, agora)}
                {f.ultimaMudanca
                  ? ` · última mudança ${haQuantoTempo(f.ultimaMudanca, agora)}`
                  : ''}
                {f.commit && ` · commit ${f.commit.slice(0, 7)}`}
                {f.repo && ` · ${f.repo}`}
              </p>
              {situacao === 'desatualizada' && (
                <p className="mt-2 text-sm text-ambar">
                  Faz mais de {DIAS_SEM_SINCRONIZAR} dias que esta fonte não é
                  conferida. Rode a ingestão de novo.
                </p>
              )}
              <p className="mt-2 text-sm">
                Na última rodada: {r.novo} novos · {r.alterado} alterados ·{' '}
                {r['sem-alteracao']} sem alteração · {r.removido} removidos ·{' '}
                {r.reapareceu} reapareceram · {r.duplicado} repetidos ·{' '}
                {r.ignorado} ignorados · {r.erro} com erro
              </p>

              {f.erros.length > 0 && (
                <div className="mt-3 rounded-md bg-ambar-fundo p-3 text-sm text-ambar">
                  <p className="font-medium">
                    Arquivos que não entraram ({f.erros.length}
                    {r.erro > f.erros.length ? ` de ${r.erro}` : ''})
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {f.erros.map((e) => (
                      <li key={e.caminho}>
                        <code>{e.caminho}</code>: {e.detalhe}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">
                    Corrija o arquivo e rode a ingestão de novo: ela só refaz o
                    que falhou.
                  </p>
                </div>
              )}

              {f.removidos.length > 0 && (
                <div className="mt-3 text-sm">
                  <p className="font-medium">
                    Arquivos que sumiram da origem ({f.removidos.length})
                  </p>
                  <p className="text-suave">
                    Os artigos continuam no ar até você decidir, na tela{' '}
                    <Link
                      to="/admin/revisao"
                      className="text-bloco-icone hover:underline"
                    >
                      Revisão
                    </Link>
                    .
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {f.removidos.map((c) => (
                      <li key={c}>
                        <code>{c}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
