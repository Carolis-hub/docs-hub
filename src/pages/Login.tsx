import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(
    searchParams.get('motivo') === 'sem-acesso'
      ? 'Sua conta não tem acesso ao docs-hub. Fale com um administrador.'
      : null,
  )
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro(null)
    setEnviando(true)

    try {
      await signIn(email, senha)
      navigate('/', { replace: true })
    } catch {
      setErro('E-mail ou senha inválidos.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h1 className="mb-6 text-center text-xl font-semibold text-slate-900 dark:text-slate-100">
          Entrar no docs-hub
        </h1>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label
              htmlFor="senha"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Senha
            </label>
            <input
              id="senha"
              type="password"
              required
              autoComplete="current-password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          {erro && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {erro}
            </p>
          )}
          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
