import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Article } from '../types/content'
import { limparMarcadores, temImagemNaoMigrada } from '../utils/content'
import { iconeDoArtigo } from '../utils/iconeDoArtigo'
import type { Visao } from './ListToolbar'

interface Props {
  artigos: Article[]
  visao: Visao
  /** Admins veem rascunhos e o aviso de imagens não migradas. */
  admin: boolean
}

export function ArticleList({ artigos, visao, admin }: Props) {
  return (
    <ul
      className={visao === 'grade' ? 'grid gap-3 sm:grid-cols-2' : 'space-y-3'}
    >
      {artigos.map((a) => {
        const Icone = iconeDoArtigo(a.titulo)
        const resumo = limparMarcadores(a.resumo)
        return (
          <li key={a.id}>
            <Link
              to={`/a/${a.id}`}
              className="cartao flex h-full gap-4 p-4 transition hover:border-destaque/50"
            >
              <span className="tile size-10">
                <Icone className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{a.titulo}</span>
                  {admin && a.status === 'draft' && (
                    <span className="selo selo-ambar">Rascunho</span>
                  )}
                  {a.publico === 'tecnico' && (
                    <span className="selo">Técnico</span>
                  )}
                  {admin && temImagemNaoMigrada(a.textoPlano ?? '') && (
                    <span className="selo selo-ambar">
                      <AlertTriangle className="size-3" aria-hidden />
                      Imagem não migrada
                    </span>
                  )}
                </span>
                {resumo && (
                  <span className="mt-1 line-clamp-2 block text-sm text-suave">
                    {resumo}
                  </span>
                )}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
