import { BookOpen, Sparkles } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePreferencias } from '../hooks/usePreferencias'
import { entradasDaAside } from '../utils/preferencias'

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

/** Aside esquerda: vale para qualquer usuário (cada pessoa escolhe o que ela mostra em Minhas configurações). */
export function Aside() {
  const { user } = useAuth()
  const { aside } = usePreferencias(user?.uid)
  const entradas = entradasDaAside(aside)
  if (entradas.length === 0) return null
  return (
    <aside
      aria-label="Visualizações"
      className="w-full shrink-0 border-b border-borda bg-cartao/70 p-4 md:w-[248px] md:border-b-0 md:border-r md:pt-6"
    >
      <span className="mb-2 hidden px-3 text-[11.5px] font-bold text-suave md:block">
        Documentação
      </span>
      <ul className="flex gap-1 md:flex-col">
        {entradas.map((e) => {
          const { para, rotulo, Icone } = ENTRADAS[e]
          return (
            <li key={e}>
              <NavLink
                to={para}
                end={para === '/'}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[14.5px] transition hover:bg-bloco/60 ${
                    isActive
                      ? 'bg-bloco font-semibold text-destaque'
                      : 'font-medium text-suave'
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
    </aside>
  )
}
