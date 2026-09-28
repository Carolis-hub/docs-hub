import { useState, type FormEvent } from 'react'
import type { AppUser, UserInput, UserRole } from '../../types/user'
import type { Block } from '../../types/block'

interface UserFormProps {
  produtos: Block[]
  usuarioInicial?: AppUser
  onSalvar: (
    valores: UserInput,
    credenciais?: { email: string; senha: string },
  ) => Promise<void>
  onCancelar: () => void
}

export function UserForm({
  produtos,
  usuarioInicial,
  onSalvar,
  onCancelar,
}: UserFormProps) {
  const ehEdicao = !!usuarioInicial
  const [nome, setNome] = useState(usuarioInicial?.nome ?? '')
  const [email, setEmail] = useState(usuarioInicial?.email ?? '')
  const [senha, setSenha] = useState('')
  const [role, setRole] = useState<UserRole>(usuarioInicial?.role ?? 'reader')
  const [verTecnico, setVerTecnico] = useState(
    usuarioInicial?.verTecnico ?? false,
  )
  const [produtosPermitidos, setProdutosPermitidos] = useState<string[]>(
    usuarioInicial?.produtosPermitidos ?? [],
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function alternarProduto(id: string) {
    setProdutosPermitidos((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id],
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro(null)

    if (!nome.trim()) {
      setErro('O nome é obrigatório.')
      return
    }
    if (!ehEdicao && (!email.trim() || senha.length < 6)) {
      setErro(
        'Informe um e-mail válido e uma senha com pelo menos 6 caracteres.',
      )
      return
    }

    setSalvando(true)
    try {
      const valores: UserInput = {
        nome: nome.trim(),
        role,
        verTecnico,
        produtosPermitidos,
      }
      if (ehEdicao) {
        await onSalvar(valores)
      } else {
        await onSalvar(valores, { email: email.trim(), senha })
      }
    } catch {
      setErro('Não foi possível salvar o usuário.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-slate-800">
        <h2
          id="user-form-title"
          className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          {ehEdicao ? 'Editar usuário' : 'Novo usuário'}
        </h2>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="user-nome"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Nome
            </label>
            <input
              id="user-nome"
              type="text"
              required
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {!ehEdicao && (
            <>
              <div>
                <label
                  htmlFor="user-email"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  E-mail
                </label>
                <input
                  id="user-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="user-senha"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  Senha provisória
                </label>
                <input
                  id="user-senha"
                  type="text"
                  required
                  minLength={6}
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="user-role"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Papel
            </label>
            <select
              id="user-role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="reader">Leitor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {role === 'reader' && (
            <>
              <div>
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Produtos permitidos
                </span>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-slate-300 p-2 dark:border-slate-600">
                  {produtos.map((produto) => (
                    <label
                      key={produto.id}
                      className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={produtosPermitidos.includes(produto.id)}
                        onChange={() => alternarProduto(produto.id)}
                      />
                      {produto.nome}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={verTecnico}
                  onChange={(event) => setVerTecnico(event.target.checked)}
                />
                Pode ver conteúdo técnico
              </label>
            </>
          )}

          {erro && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancelar}
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
