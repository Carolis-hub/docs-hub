import { useMemo, useState } from 'react'
import { ScrollText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { useAsync } from '../../hooks/useAsync'
import { listarAuditoria } from '../../services/audit'
import { listUsers } from '../../services/users'
import {
  GRUPOS_AUDITORIA,
  artigoDoAlvo,
  grupoDaAcao,
  rotuloDaAuditoria,
} from '../../utils/auditoria'

const LIMITE = 200

/** Trilha de auditoria: quem fez o quê, quando e sobre qual item. */
export function AuditoriaPage() {
  const { dados, erro, carregando, recarregar } = useAsync(async () => {
    const [registros, usuarios] = await Promise.all([
      listarAuditoria(LIMITE),
      listUsers().catch(() => []),
    ])
    return { registros, nomes: new Map(usuarios.map((u) => [u.uid, u.nome])) }
  }, [])
  const [grupo, setGrupo] = useState('')
  const [usuario, setUsuario] = useState('')

  const registros = useMemo(
    () =>
      (dados?.registros ?? []).filter(
        (r) =>
          (!grupo || grupoDaAcao(r.acao) === grupo) &&
          (!usuario || r.usuarioId === usuario),
      ),
    [dados, grupo, usuario],
  )
  const usuarios = useMemo(() => {
    const ids = new Set((dados?.registros ?? []).map((r) => r.usuarioId))
    return [...ids].sort((a, b) =>
      (dados?.nomes.get(a) ?? a).localeCompare(
        dados?.nomes.get(b) ?? b,
        'pt-BR',
      ),
    )
  }, [dados])
  const nomeDe = (id: string) => dados?.nomes.get(id) ?? id

  return (
    <div>
      <PageHeader
        icone={ScrollText}
        titulo="Auditoria"
        subtitulo={`Os ${LIMITE} registros mais recentes: quem fez o quê e quando.`}
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

      {dados && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              aria-label="Filtrar por tipo de ação"
              className="campo w-auto"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
            >
              <option value="">Todas as ações</option>
              {GRUPOS_AUDITORIA.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por usuário"
              className="campo w-auto"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            >
              <option value="">Todos os usuários</option>
              {usuarios.map((id) => (
                <option key={id} value={id}>
                  {nomeDe(id)}
                </option>
              ))}
            </select>
            <span className="text-sm text-suave" aria-live="polite">
              {registros.length} registro{registros.length === 1 ? '' : 's'}
            </span>
          </div>

          {registros.length === 0 ? (
            <p className="text-suave">Nenhum registro com esses filtros.</p>
          ) : (
            <ul className="divide-y divide-borda rounded-lg border border-borda bg-cartao text-sm">
              {registros.map((r) => {
                const artigoId = artigoDoAlvo(r.alvo)
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-2"
                  >
                    <span className="text-suave">
                      {new Date(r.data).toLocaleString('pt-BR')}
                    </span>
                    <strong>{nomeDe(r.usuarioId)}</strong>
                    <span>{rotuloDaAuditoria(r.acao)}</span>
                    {r.detalhe && (
                      <span className="text-suave">({r.detalhe})</span>
                    )}
                    {artigoId ? (
                      <Link
                        to={`/admin/artigos/${artigoId}/editar`}
                        className="text-bloco-icone hover:underline"
                      >
                        {r.alvo}
                      </Link>
                    ) : (
                      <span className="text-suave">{r.alvo}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
