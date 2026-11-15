import { BookOpen, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePreferencias } from '../hooks/usePreferencias'
import { podeAcessar } from '../utils/permissoes'
import { entradasDaAside } from '../utils/preferencias'

const ENTRADAS = {
  manual: {
    para: '/',
    rotulo: 'Manual de produtos',
    Icone: BookOpen,
  },
  busca: {
    para: '/assistente',
    rotulo: 'Buscar Artigo',
    Icone: Search,
  },
}

const CHAVE_RECOLHIDA = 'docshub.aside.recolhida'

/** Recolhida ou não: fica só neste navegador (se não der para guardar, vale a sessão). */
function lerRecolhida(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_RECOLHIDA) === '1'
  } catch {
    return false
  }
}

/**
 * Aside esquerda: vale para qualquer usuário (cada pessoa escolhe o que ela
 * mostra em Minhas configurações). Fica fixa enquanto o resto da tela rola e
 * pode ser recolhida para uma faixa só com os ícones.
 */
export function Aside() {
  const { user, profile } = useAuth()
  const { aside } = usePreferencias(user?.uid)
  const [recolhida, setRecolhida] = useState(lerRecolhida)
  // O que o administrador bloqueou para a conta some, valha o que a pessoa escolheu.
  const entradas = entradasDaAside(aside).filter((e) => podeAcessar(profile, e))
  // "Mostrar a aside" desmarcado pelo administrador esconde o menu inteiro.
  if (!podeAcessar(profile, 'aside') || entradas.length === 0) return null

  function alternar() {
    const nova = !recolhida
    setRecolhida(nova)
    try {
      window.localStorage.setItem(CHAVE_RECOLHIDA, nova ? '1' : '0')
    } catch {
      // Sem armazenamento (janela privada, por exemplo): vale só nesta sessão.
    }
  }

  const Alternar = recolhida ? PanelLeftOpen : PanelLeftClose
  return (
    <aside
      aria-label="Visualizações"
      className={`w-full shrink-0 border-b border-borda bg-cartao/70 p-4 md:sticky md:top-0 md:h-screen md:self-start md:overflow-y-auto md:border-b-0 md:border-r md:pt-6 ${recolhida ? 'md:w-[72px] md:px-3' : 'md:w-[248px]'}`}
    >
      <div
        className={`mb-2 hidden items-center md:flex ${recolhida ? 'justify-center' : 'justify-between pl-3'}`}
      >
        {!recolhida && (
          <span className="text-[11.5px] font-bold text-suave">
            Documentação
          </span>
        )}
        <button
          type="button"
          className="botao-icone"
          aria-expanded={!recolhida}
          aria-label={
            recolhida ? 'Expandir menu lateral' : 'Recolher menu lateral'
          }
          title={recolhida ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          onClick={alternar}
        >
          <Alternar className="size-4" aria-hidden />
        </button>
      </div>
      <ul className="flex gap-1 md:flex-col">
        {entradas.map((e) => {
          const { para, rotulo, Icone } = ENTRADAS[e]
          return (
            <li key={e}>
              <NavLink
                to={para}
                end={para === '/'}
                title={recolhida ? rotulo : undefined}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[14.5px] transition hover:bg-bloco/60 ${recolhida ? 'md:justify-center md:px-0' : ''} ${
                    isActive
                      ? 'bg-bloco font-semibold text-destaque'
                      : 'font-medium text-suave'
                  }`
                }
              >
                <Icone className="size-4 shrink-0" aria-hidden />
                {/* Recolhida, o nome some da tela (md+) mas continua para leitores de tela. */}
                <span className={recolhida ? 'md:sr-only' : ''}>{rotulo}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
