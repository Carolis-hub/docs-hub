import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../hooks/useAuth'
import { deleteUsers, listUsers } from '../services/users'
import type { AppUser } from '../types/user'
import { Carregando } from './Carregando'

/**
 * Bloco "Configuração de usuário" da tela Configurações: todos os usuários,
 * com criar e excluir em lote no início e editar/excluir em cada linha.
 */
export function ListaDeUsuarios() {
  const { user } = useAuth()
  const adminUid = user?.uid ?? ''
  const { dados, erro, carregando, recarregar } = useAsync(listUsers, [])
  const [filtro, setFiltro] = useState('')
  const [marcados, setMarcados] = useState<string[]>([])
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(
    null,
  )
  const [excluindo, setExcluindo] = useState(false)

  const todos = dados ?? []
  const termo = filtro.trim().toLowerCase()
  const visiveis = todos.filter((u) =>
    `${u.nome} ${u.email}`.toLowerCase().includes(termo),
  )
  // A própria conta nunca entra na seleção: ninguém se exclui.
  const selecionaveis = visiveis.filter((u) => u.uid !== adminUid)
  const selecionados = todos.filter((u) => marcados.includes(u.uid))
  const todosMarcados =
    selecionaveis.length > 0 &&
    selecionaveis.every((u) => marcados.includes(u.uid))

  const alternar = (uid: string) =>
    setMarcados((atual) =>
      atual.includes(uid) ? atual.filter((m) => m !== uid) : [...atual, uid],
    )

  async function excluir(alvos: AppUser[]) {
    if (alvos.length === 0) return
    const pergunta =
      alvos.length === 1
        ? `Excluir o usuário "${alvos[0]?.nome}"? Ele perde o acesso na hora.`
        : `Excluir ${alvos.length} usuários? Eles perdem o acesso na hora.\n\n${alvos.map((u) => `• ${u.nome}`).join('\n')}`
    if (!window.confirm(pergunta)) return
    setExcluindo(true)
    setAviso(null)
    try {
      const uids = alvos.map((u) => u.uid)
      await deleteUsers(uids, adminUid)
      setMarcados((atual) => atual.filter((m) => !uids.includes(m)))
      setAviso({
        erro: false,
        texto:
          alvos.length === 1
            ? 'Usuário excluído.'
            : `${alvos.length} usuários excluídos.`,
      })
      recarregar()
    } catch (e) {
      setAviso({
        erro: true,
        texto: e instanceof Error ? e.message : 'Não foi possível excluir.',
      })
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <section aria-labelledby="configuracao-de-usuario" className="cartao p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="configuracao-de-usuario" className="text-lg font-bold">
            Configuração de usuário
          </h2>
          <p className="text-sm text-suave">
            Contas, dados cadastrais e permissões de cada pessoa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/admin/usuarios/novo" className="botao botao-primario">
            <Plus className="size-4" aria-hidden />
            Novo usuário
          </Link>
          <button
            type="button"
            className="botao botao-perigo"
            disabled={selecionados.length === 0 || excluindo}
            title={
              selecionados.length === 0
                ? 'Marque os usuários na lista para excluir em lote'
                : undefined
            }
            onClick={() => void excluir(selecionados)}
          >
            <Trash2 className="size-4" aria-hidden />
            Excluir selecionados
            {selecionados.length > 0 && ` (${selecionados.length})`}
          </button>
        </div>
      </div>

      {aviso && (
        <p
          role={aviso.erro ? 'alert' : 'status'}
          className={`mt-3 text-sm ${aviso.erro ? 'text-perigo' : 'text-suave'}`}
        >
          {aviso.texto}
        </p>
      )}
      {carregando && !dados && <Carregando />}
      {erro && (
        <p role="alert" className="mt-3 text-sm text-perigo">
          {erro}
        </p>
      )}

      {dados && (
        <>
          <label className="sr-only" htmlFor="filtro-usuarios">
            Filtrar usuários
          </label>
          <input
            id="filtro-usuarios"
            type="search"
            className="campo mt-4"
            placeholder="Filtrar por nome ou e-mail…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
          {visiveis.length === 0 ? (
            <p className="mt-3 text-sm text-suave">
              Nenhum usuário encontrado.
            </p>
          ) : (
            <>
              <label className="mt-4 flex items-center gap-3 border-b border-borda px-1 pb-2 text-xs font-semibold text-suave">
                <input
                  type="checkbox"
                  checked={todosMarcados}
                  disabled={selecionaveis.length === 0}
                  onChange={(e) =>
                    setMarcados(
                      e.target.checked ? selecionaveis.map((u) => u.uid) : [],
                    )
                  }
                />
                Selecionar todos ({visiveis.length})
              </label>
              <ul aria-label="Usuários" className="divide-y divide-borda">
                {visiveis.map((u) => {
                  const eu = u.uid === adminUid
                  return (
                    <li
                      key={u.uid}
                      className="flex items-center gap-3 px-1 py-2.5"
                    >
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${u.nome}`}
                        checked={marcados.includes(u.uid)}
                        disabled={eu}
                        onChange={() => alternar(u.uid)}
                      />
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{u.nome}</span>
                          <span className="selo">
                            {u.role === 'admin' ? 'Administrador' : 'Leitor'}
                          </span>
                          {eu && <span className="selo">Você</span>}
                          {u.ativo === false && (
                            <span className="selo text-perigo">Desativado</span>
                          )}
                        </p>
                        <p className="truncate text-suave">{u.email}</p>
                      </div>
                      <Link
                        to={`/admin/usuarios/${u.uid}/editar`}
                        className="botao-icone"
                        title="Editar"
                        aria-label={`Editar ${u.nome}`}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Link>
                      <button
                        type="button"
                        className="botao-icone hover:text-perigo"
                        disabled={eu || excluindo}
                        title={
                          eu
                            ? 'Você não pode excluir a própria conta'
                            : 'Excluir'
                        }
                        aria-label={`Excluir ${u.nome}`}
                        onClick={() => void excluir([u])}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  )
}
