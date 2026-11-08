import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../hooks/useAuth'
import { useModoAside } from '../hooks/useModoAside'
import { MODOS_ASIDE } from '../utils/aside'
import {
  chaveIAValida,
  gravarChaveIA,
  lerChaveIA,
  mascararChave,
} from '../utils/chaveIA'

export function PreferenciasPage() {
  const { user } = useAuth()
  const uid = user?.uid ?? ''
  const { modo, setModo } = useModoAside(user?.uid)
  const [guardada, setGuardada] = useState(() => lerChaveIA(uid))
  const [campo, setCampo] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)

  function salvar() {
    if (!chaveIAValida(campo)) {
      setAviso('Chave inválida: use uma linha só, sem espaços.')
      return
    }
    gravarChaveIA(uid, campo)
    setGuardada(campo.trim())
    setCampo('')
    setAviso('Chave guardada neste navegador.')
  }

  function remover() {
    gravarChaveIA(uid, '')
    setGuardada('')
    setAviso('Chave removida.')
  }

  return (
    <div className="max-w-xl">
      <PageHeader icone={KeyRound} titulo="Minhas preferências" />
      <fieldset className="cartao mb-6 p-5">
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
                name="modo-aside-preferencias"
                checked={modo === m.valor}
                onChange={() => setModo(m.valor)}
              />
              {m.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <section aria-labelledby="chave-ia" className="cartao p-5">
        <h2 id="chave-ia" className="text-sm font-medium text-texto">
          Chave da API de IA (Anthropic)
        </h2>
        <p className="mt-1 text-sm text-suave">
          Usada na busca com IA no lugar da chave do servidor. Fica só neste
          navegador: não é gravada no banco nem nos registros. Em outro
          navegador, informe de novo.
        </p>
        <p className="mt-3 text-sm">
          {guardada ? (
            <>
              Chave atual: <code>{mascararChave(guardada)}</code>
            </>
          ) : (
            'Nenhuma chave guardada.'
          )}
        </p>
        <label className="mt-3 block text-sm">
          Nova chave
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={campo}
            onChange={(e) => setCampo(e.target.value)}
            className="campo mt-1 w-full"
          />
        </label>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="botao botao-primario"
            onClick={salvar}
            disabled={!campo}
          >
            Guardar
          </button>
          {guardada && (
            <button type="button" className="botao" onClick={remover}>
              Remover
            </button>
          )}
        </div>
        {aviso && (
          <p role="status" className="mt-3 text-sm text-suave">
            {aviso}
          </p>
        )}
      </section>
    </div>
  )
}
