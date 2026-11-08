import { BookOpen, Sparkles } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useModoAside } from '../hooks/useModoAside'
import { entradasVisiveis } from '../utils/aside'

const ENTRADAS = {
  manual: {
    para: '/categorias',
    rotulo: 'Manual de produtos',
    Icone: BookOpen,
  },
  busca: {
    para: '/assistente',
    rotulo: 'Busca/consulta com IA',
    Icone: Sparkles,
  },
}

export function Aside() {
  const { user, isAdmin } = useAuth()
  const { modo } = useModoAside(user?.uid)
  const entradas = entradasVisiveis(modo, isAdmin)
  if (entradas.length === 0) return null
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
    </aside>
  )
}
