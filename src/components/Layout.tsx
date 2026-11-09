import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Layers, PanelLeft, Sparkles } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePreferencias } from '../hooks/usePreferencias'
import { estaEmConfiguracoes } from '../utils/governanca'
import { iniciais } from '../utils/iniciais'
import { Aside } from './Aside'
import { PainelAssistente } from './PainelAssistente'
import { QuickSearch } from './QuickSearch'
import { ThemeToggle } from './ThemeToggle'

const LINKS_ADMIN = [
  { para: '/admin/metricas', rotulo: 'Métricas' },
  { para: '/admin/configuracoes', rotulo: 'Configurações' },
]

export function Layout({ children }: { children: ReactNode }) {
  const { user, profile, isAdmin, signOut } = useAuth()
  const { aside, atualizarAside } = usePreferencias(user?.uid)
  const { pathname } = useLocation()
  const [painelAberto, setPainelAberto] = useState(false)
  const fecharPainel = useCallback(() => setPainelAberto(false), [])
  useEffect(() => {
    // Na página do assistente a conversa já está na tela.
    if (pathname === '/assistente') setPainelAberto(false)
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-borda bg-cartao/95">
        <div className="flex min-h-16 flex-wrap items-center gap-x-7 gap-y-2 px-8">
          <Link
            to="/"
            className="flex min-h-16 items-center gap-2.5 text-[17px] font-extrabold text-texto"
          >
            <span className="inline-flex size-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#1FAE6E] to-[#173C32] text-white">
              <Layers className="size-4" aria-hidden />
            </span>
            docs-hub
          </Link>

          {isAdmin && (
            <nav
              aria-label="Administração"
              className="flex gap-1 self-stretch text-sm"
            >
              {LINKS_ADMIN.map((l) => (
                <NavLink
                  key={l.para}
                  to={l.para}
                  className={({ isActive }) => {
                    const ativo =
                      l.para === '/admin/configuracoes'
                        ? estaEmConfiguracoes(pathname)
                        : isActive
                    return `flex h-full min-h-16 items-center border-b-2 px-3 text-[14.5px] transition hover:text-texto ${ativo ? 'border-destaque font-semibold text-texto' : 'border-transparent font-medium text-suave'}`
                  }}
                >
                  {l.rotulo}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-2">
            {!aside.visivel && (
              <button
                type="button"
                onClick={() => void atualizarAside({ visivel: true })}
                className="botao-icone"
                title="Mostrar menu lateral"
                aria-label="Mostrar menu lateral"
              >
                <PanelLeft className="size-4" aria-hidden />
              </button>
            )}
            <QuickSearch />
            <ThemeToggle />
            {user && (
              <div className="flex items-center gap-2.5">
                <Link
                  to="/preferencias"
                  title="Minhas preferências"
                  aria-label="Minhas preferências"
                  className="inline-flex size-[34px] items-center justify-center rounded-full bg-[#3F5FA8] text-xs font-bold text-white"
                >
                  {iniciais(profile?.nome, user.email)}
                </Link>
                <span className="hidden flex-col leading-tight sm:flex">
                  <span className="text-[13.5px] font-semibold">
                    {profile?.nome || user.email}
                  </span>
                  <span className="text-xs text-suave">
                    {isAdmin ? 'Administrador' : 'Leitor'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="rounded px-1 text-sm font-medium text-suave hover:text-texto"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <Aside />
        <main className="mx-auto w-full max-w-[1240px] min-w-0 flex-1 px-8 pb-24 pt-8">
          {children}
        </main>
      </div>
      {pathname !== '/assistente' && (
        <>
          <PainelAssistente aberto={painelAberto} aoFechar={fecharPainel} />
          {!painelAberto && (
            <button
              type="button"
              onClick={() => setPainelAberto(true)}
              className="fixed bottom-6 right-6 z-30 flex h-[52px] items-center gap-2.5 rounded-full bg-escuro pl-3 pr-5 text-[15px] font-semibold text-white shadow-[0_0_0_4px_rgb(61_220_151_/_0.16),0_18px_40px_rgb(18_53_43_/_0.3)]"
            >
              <span className="inline-flex size-[30px] items-center justify-center rounded-full bg-[#7CC4A3] text-[#0E2A22]">
                <Sparkles className="size-4" aria-hidden />
              </span>
              Assistente
            </button>
          )}
        </>
      )}
    </div>
  )
}
