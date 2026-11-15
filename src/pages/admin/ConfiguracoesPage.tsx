import { ChevronRight, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { permissaoDaRota, podeAcessar } from '../../utils/permissoes'
import { ListaDeUsuarios } from '../../components/ListaDeUsuarios'
import { PageHeader } from '../../components/PageHeader'
import { MODULO_GOVERNANCA } from '../../utils/governanca'

/** Configurações: dois grandes blocos, "Configuração de usuário" e "Governança". */
export function ConfiguracoesPage() {
  const { profile } = useAuth()
  // Cada tela de administração só aparece para quem tem a permissão dela.
  const governanca = MODULO_GOVERNANCA.filter((m) => {
    const id = permissaoDaRota(m.para)
    return !id || podeAcessar(profile, id)
  })
  const usuarios = podeAcessar(profile, 'usuarios')
  return (
    <div>
      <PageHeader
        icone={Settings}
        titulo="Configurações"
        subtitulo="Usuários do sistema e governança do conteúdo."
      />
      <div
        className={`grid items-start gap-6 ${usuarios ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''}`}
      >
        {usuarios && <ListaDeUsuarios />}
        <ModuloDeLinks id="governanca" titulo="Governança" itens={governanca} />
      </div>
    </div>
  )
}

function ModuloDeLinks({
  id,
  titulo,
  itens,
}: {
  id: string
  titulo: string
  itens: typeof MODULO_GOVERNANCA
}) {
  if (itens.length === 0) return null
  return (
    <section aria-labelledby={id} className="cartao p-5">
      <h2 id={id} className="text-lg font-bold">
        {titulo}
      </h2>
      <ul className="mt-3 divide-y divide-borda">
        {itens.map((m) => (
          <li key={m.para}>
            <Link
              to={m.para}
              className="flex items-center justify-between gap-3 py-3 transition hover:text-destaque"
            >
              <span>
                <span className="block text-sm font-semibold">{m.rotulo}</span>
                <span className="block text-sm text-suave">{m.descricao}</span>
              </span>
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
