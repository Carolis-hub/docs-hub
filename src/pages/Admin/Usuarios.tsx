import { useCallback, useEffect, useState } from 'react'
import { listProducts } from '../../services/blocks'
import {
  createUser,
  listUsers,
  setUserAtivo,
  updateUser,
} from '../../services/users'
import { UserForm } from '../../components/admin/UserForm'
import { useAuth } from '../../hooks/useAuth'
import type { Block } from '../../types/block'
import type { AppUser, UserInput } from '../../types/user'

const rotuloRole: Record<AppUser['role'], string> = {
  reader: 'Leitor',
  admin: 'Admin',
}

export function AdminUsuarios() {
  const { user } = useAuth()
  const [usuarios, setUsuarios] = useState<AppUser[]>([])
  const [produtos, setProdutos] = useState<Block[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<
    { modo: 'criar' } | { modo: 'editar'; usuario: AppUser } | null
  >(null)

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro(null)
    Promise.all([listUsers(), listProducts()])
      .then(([listaUsuarios, listaProdutos]) => {
        setUsuarios(listaUsuarios)
        setProdutos(listaProdutos)
      })
      .catch(() => setErro('Não foi possível carregar os usuários.'))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function handleCriar(
    valores: UserInput,
    credenciais?: { email: string; senha: string },
  ) {
    if (!user || !credenciais) return
    await createUser(valores, credenciais.email, credenciais.senha, user.uid)
    setFormulario(null)
    carregar()
  }

  async function handleEditar(usuario: AppUser, valores: UserInput) {
    if (!user) return
    await updateUser(usuario.uid, valores, user.uid)
    setFormulario(null)
    carregar()
  }

  async function handleAlternarAtivo(usuario: AppUser) {
    if (!user) return
    const acao = usuario.ativo ? 'desativar' : 'reativar'
    if (!window.confirm(`Deseja ${acao} o usuário "${usuario.nome}"?`)) return
    await setUserAtivo(usuario.uid, !usuario.ativo, user.uid)
    carregar()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Usuários
        </h1>
        <button
          type="button"
          onClick={() => setFormulario({ modo: 'criar' })}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
        >
          Novo usuário
        </button>
      </div>

      {erro && (
        <p role="alert" className="mb-4 text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}

      {carregando && (
        <p className="text-slate-500 dark:text-slate-400">Carregando…</p>
      )}

      {!carregando && (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {usuarios.map((usuario) => (
            <li
              key={usuario.uid}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {usuario.nome}{' '}
                  {!usuario.ativo && (
                    <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      Desativado
                    </span>
                  )}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {usuario.email} · {rotuloRole[usuario.role]}
                  {usuario.role === 'reader' &&
                    ` · ${usuario.produtosPermitidos.length} produto(s)${usuario.verTecnico ? ' · vê técnico' : ''}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setFormulario({ modo: 'editar', usuario })}
                  className="rounded-md px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => void handleAlternarAtivo(usuario)}
                  className="rounded-md px-2.5 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {usuario.ativo ? 'Desativar' : 'Reativar'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formulario?.modo === 'criar' && (
        <UserForm
          produtos={produtos}
          onSalvar={handleCriar}
          onCancelar={() => setFormulario(null)}
        />
      )}
      {formulario?.modo === 'editar' && (
        <UserForm
          produtos={produtos}
          usuarioInicial={formulario.usuario}
          onSalvar={(valores) => handleEditar(formulario.usuario, valores)}
          onCancelar={() => setFormulario(null)}
        />
      )}
    </div>
  )
}
