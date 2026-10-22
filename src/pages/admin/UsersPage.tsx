import { useState, type FormEvent } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { listProducts } from '../../services/blocks'
import {
  createUser,
  listUsers,
  setUserAtivo,
  updateUser,
} from '../../services/users'
import type { Block } from '../../types/content'
import type { AppUser, UserRole } from '../../types/user'

const campo =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900'
const botaoSec =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600'

interface FormProps {
  produtos: Block[]
  /** Sem `usuario`, o formulário cria uma conta nova. */
  usuario?: AppUser
  adminUid: string
  onDone: () => void
  onCancel: () => void
}

function UserForm({
  produtos,
  usuario,
  adminUid,
  onDone,
  onCancel,
}: FormProps) {
  const editando = !!usuario
  const [nome, setNome] = useState(usuario?.nome ?? '')
  const [email, setEmail] = useState(usuario?.email ?? '')
  const [senha, setSenha] = useState('')
  const [role, setRole] = useState<UserRole>(usuario?.role ?? 'reader')
  const [permitidos, setPermitidos] = useState<string[]>(
    usuario?.produtosPermitidos ?? [],
  )
  const [verTecnico, setVerTecnico] = useState(usuario?.verTecnico ?? false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const admin = role === 'admin'

  function alternar(id: string) {
    setPermitidos((atual) =>
      atual.includes(id) ? atual.filter((p) => p !== id) : [...atual, id],
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      if (usuario) {
        await updateUser(
          usuario.uid,
          { nome, role, produtosPermitidos: permitidos, verTecnico },
          adminUid,
        )
      } else {
        await createUser(
          {
            nome,
            email,
            senha,
            role,
            produtosPermitidos: permitidos,
            verTecnico,
          },
          adminUid,
        )
      }
      onDone()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      aria-label={editando ? 'Editar usuário' : 'Novo usuário'}
      className="mb-6 max-w-lg space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
    >
      <h2 className="font-semibold">
        {editando ? 'Editar usuário' : 'Novo usuário'}
      </h2>
      <label className="block text-sm">
        Nome
        <input
          className={campo}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        E-mail
        <input
          type="email"
          className={campo}
          value={email}
          disabled={editando}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {!editando && (
        <label className="block text-sm">
          Senha inicial
          <input
            type="password"
            autoComplete="new-password"
            className={campo}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
      )}
      <label className="block text-sm">
        Papel
        <select
          className={campo}
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
        >
          <option value="reader">Leitor</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      {admin ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Admins veem todos os produtos e o conteúdo técnico.
        </p>
      ) : (
        <>
          <fieldset className="text-sm">
            <legend className="mb-1">Produtos permitidos</legend>
            {produtos.length === 0 && (
              <p className="text-slate-500">Nenhum produto cadastrado.</p>
            )}
            {produtos.map((p) => (
              <label key={p.id} className="mr-4 inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={permitidos.includes(p.id)}
                  onChange={() => alternar(p.id)}
                />
                {p.nome}
              </label>
            ))}
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={verTecnico}
              onChange={(e) => setVerTecnico(e.target.checked)}
            />
            Pode ver artigos técnicos
          </label>
        </>
      )}
      {erro && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={onCancel} className={botaoSec}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export function UsersPage() {
  const { user } = useAuth()
  const adminUid = user?.uid ?? ''
  const { dados, erro, carregando, recarregar } = useAsync(async () => {
    const [usuarios, produtos] = await Promise.all([
      listUsers(),
      listProducts(),
    ])
    return { usuarios, produtos }
  }, [])
  const [modo, setModo] = useState<'novo' | AppUser | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function alternarAtivo(u: AppUser) {
    try {
      await setUserAtivo(u.uid, u.ativo === false, adminUid)
      setAviso(null)
      recarregar()
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível alterar.')
    }
  }

  const nomesProdutos = new Map(
    (dados?.produtos ?? []).map((p) => [p.id, p.nome]),
  )

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuários</h1>
        {!modo && (
          <button
            type="button"
            onClick={() => setModo('novo')}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Novo usuário
          </button>
        )}
      </div>

      {modo && dados && (
        <UserForm
          key={modo === 'novo' ? 'novo' : modo.uid}
          produtos={dados.produtos}
          usuario={modo === 'novo' ? undefined : modo}
          adminUid={adminUid}
          onCancel={() => setModo(null)}
          onDone={() => {
            setModo(null)
            recarregar()
          }}
        />
      )}
      {aviso && (
        <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
          {aviso}
        </p>
      )}
      {carregando && !dados && <p className="text-slate-500">Carregando…</p>}
      {erro && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}

      {dados && (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
          {dados.usuarios.map((u) => (
            <li
              key={u.uid}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <span className="font-medium">{u.nome}</span>
                <span className="ml-2 text-slate-500">{u.email}</span>
                <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs dark:bg-slate-700">
                  {u.role === 'admin' ? 'Admin' : 'Leitor'}
                </span>
                {u.ativo === false && (
                  <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800 dark:bg-red-900 dark:text-red-200">
                    Desativado
                  </span>
                )}
                {u.role === 'reader' && (
                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                    Produtos:{' '}
                    {u.produtosPermitidos.length
                      ? u.produtosPermitidos
                          .map((id) => nomesProdutos.get(id) ?? id)
                          .join(', ')
                      : 'nenhum'}
                    {u.verTecnico && ' · vê técnico'}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={botaoSec}
                  onClick={() => setModo(u)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={botaoSec}
                  onClick={() => void alternarAtivo(u)}
                >
                  {u.ativo === false ? 'Reativar' : 'Desativar'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
