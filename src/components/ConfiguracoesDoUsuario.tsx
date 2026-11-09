import { BookOpen, Sparkles, type LucideIcon } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePreferencias } from '../hooks/usePreferencias'
import type { EntradaAside } from '../utils/aside'
import {
  ASIDE_PADRAO,
  ENTRADAS_DA_ASIDE,
  entradasDaAside,
} from '../utils/preferencias'

const ICONES: Record<EntradaAside, LucideIcon> = {
  manual: BookOpen,
  busca: Sparkles,
}

/**
 * Configurações da própria pessoa (modelo `PreferenciasUsuario`): hoje, a
 * aside esquerda. Ficam na conta, então valem em qualquer navegador.
 */
export function ConfiguracoesDoUsuario() {
  const { user } = useAuth()
  const { aside, erro, atualizarAside } = usePreferencias(user?.uid)
  const mostradas = entradasDaAside(aside)
  const igualAoPadrao =
    aside.visivel === ASIDE_PADRAO.visivel &&
    aside.manual === ASIDE_PADRAO.manual &&
    aside.busca === ASIDE_PADRAO.busca

  return (
    <section aria-labelledby="minhas-configuracoes" className="cartao p-5">
      <h2 id="minhas-configuracoes" className="text-lg font-bold">
        Minhas configurações
      </h2>
      <p className="mt-1 text-sm text-suave">
        Valem só para você e acompanham a sua conta em qualquer navegador.
      </p>

      <fieldset className="mt-5 space-y-3">
        <legend className="text-sm font-semibold">Aside lateral</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={aside.visivel}
            onChange={(e) => void atualizarAside({ visivel: e.target.checked })}
          />
          Mostrar a aside
        </label>
        <div
          role="group"
          aria-label="Entradas da aside"
          className="space-y-2 border-l-2 border-borda pl-4"
        >
          {ENTRADAS_DA_ASIDE.map((e) => (
            <label
              key={e.id}
              className={`flex items-center gap-2 text-sm ${aside.visivel ? '' : 'opacity-50'}`}
            >
              <input
                type="checkbox"
                disabled={!aside.visivel}
                checked={aside[e.id]}
                onChange={(ev) =>
                  void atualizarAside({ [e.id]: ev.target.checked })
                }
              />
              {e.rotulo}
            </label>
          ))}
        </div>

        <div aria-label="Prévia da aside" className="rounded-xl bg-fundo p-3">
          <p className="mb-2 text-xs font-semibold text-suave">Prévia</p>
          {mostradas.length === 0 ? (
            <p className="text-sm italic text-suave">
              {aside.visivel
                ? 'Nenhuma entrada marcada: a aside não aparece.'
                : 'A aside está oculta. Use o botão no topo da tela para reabrir.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {mostradas.map((id) => {
                const Icone = ICONES[id]
                const rotulo = ENTRADAS_DA_ASIDE.find(
                  (e) => e.id === id,
                )?.rotulo
                return (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-lg bg-bloco px-3 py-2 text-sm font-medium text-destaque"
                  >
                    <Icone className="size-4" aria-hidden />
                    {rotulo}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="botao"
          disabled={igualAoPadrao}
          onClick={() => void atualizarAside(ASIDE_PADRAO)}
        >
          Restaurar o padrão
        </button>
        {erro && (
          <p role="alert" className="text-sm text-perigo">
            {erro}
          </p>
        )}
      </fieldset>
    </section>
  )
}
