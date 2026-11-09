import { ChevronRight, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ConfiguracoesDoUsuario } from '../../components/ConfiguracoesDoUsuario'
import { PageHeader } from '../../components/PageHeader'
import { MODULO_ADMINISTRACAO, MODULO_GOVERNANCA } from '../../utils/governanca'

export function ConfiguracoesPage() {
  return (
    <div>
      <PageHeader
        icone={Settings}
        titulo="Configurações"
        subtitulo="Suas configurações pessoais e os módulos de administração do sistema."
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ConfiguracoesDoUsuario />
        <div className="space-y-6">
          <ModuloDeLinks
            id="administracao"
            titulo="Administração"
            itens={MODULO_ADMINISTRACAO}
          />
          <ModuloDeLinks
            id="governanca"
            titulo="Governança"
            itens={MODULO_GOVERNANCA}
          />
        </div>
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
