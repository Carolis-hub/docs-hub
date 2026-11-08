import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useModoAside } from '../../hooks/useModoAside'
import { MODOS_ASIDE } from '../../utils/aside'
import { MODULO_GOVERNANCA } from '../../utils/governanca'

export function ConfiguracoesPage() {
  const { user } = useAuth()
  const { modo, setModo } = useModoAside(user?.uid)
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-texto">Configurações</h1>
      <fieldset className="cartao mt-6 p-5">
        <legend className="px-1 text-sm font-medium text-texto">
          Aside lateral
        </legend>
        <p className="mb-3 text-sm text-suave">
          Vale só para você, neste navegador.
        </p>
        <div className="space-y-2">
          {MODOS_ASIDE.map((m) => (
            <label key={m.valor} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="modo-aside"
                checked={modo === m.valor}
                onChange={() => setModo(m.valor)}
              />
              {m.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <section aria-labelledby="governanca" className="cartao mt-6 p-5">
        <h2 id="governanca" className="text-sm font-medium text-texto">
          Governança
        </h2>
        <ul className="mt-3 divide-y divide-borda">
          {MODULO_GOVERNANCA.map((m) => (
            <li key={m.para}>
              <Link
                to={m.para}
                className="flex items-center justify-between gap-3 py-3 transition hover:text-destaque"
              >
                <span>
                  <span className="block text-sm font-semibold">
                    {m.rotulo}
                  </span>
                  <span className="block text-sm text-suave">
                    {m.descricao}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
