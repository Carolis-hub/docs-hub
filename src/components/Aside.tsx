import { BookOpen, Settings2, Sparkles } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useModoAside } from '../hooks/useModoAside'
import { entradasVisiveis, MODOS_ASIDE } from '../utils/aside'

const ENTRADAS = {
  manual: {
    para: '/',
    rotulo: 'Manual de produtos',
    Icone: BookOpen,
  },
  busca: {
    para: '/assistente',
    rotulo: 'Busca/consulta com IA',
    Icone: Sparkles,
  },
}

/** Aside esquerda: vale para qualquer usuário, que escolhe o que ela mostra. */
export function Aside() {
  const { user } = useAuth()
  const { modo, setModo } = useModoAside(user?.uid)
  const entradas = entradasVisiveis(modo)
  if (modo === 'oculta') return null
  return (
    <aside
      aria-label="Visualizações"
      className="w-full shrink-0 border-b border-borda bg-fundo p-4 md:w-56 md:border-b-0 md:border-r"
    >
      <ul className="flex gap-2 md:flex-col">
        {entradas.map((e) => {
          const { para, rotulo, Icone } = ENTRADAS[e]
          return (
            <li key={e}>
              <NavLink
                to={para}
                end={para === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-cartao ${
                    isActive ? 'bg-cartao font-medium text-texto' : 'text-suave'
                  }`
                }
              >
                <Icone className="size-4" aria-hidden />
                {rotulo}
              </NavLink>
            </li>
          )
        })}
      </ul>
      <details className="mt-4 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-1 text-suave hover:text-texto">
          <Settings2 className="size-4" aria-hidden />
          Configurar aside
        </summary>
        <div className="mt-2 space-y-2 px-3">
          {MODOS_ASIDE.map((m) => (
            <label key={m.valor} className="flex items-start gap-2">
              <input
                type="radio"
                name="modo-aside-lateral"
                className="mt-0.5"
                checked={modo === m.valor}
                onChange={() => setModo(m.valor)}
              />
              {m.rotulo}
            </label>
          ))}
        </div>
      </details>
    </aside>
  )
}
