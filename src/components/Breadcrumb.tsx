import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Article, Block } from '../types/content'

interface Props {
  cadeia: Block[]
  artigo?: Pick<Article, 'titulo'>
}

export function Breadcrumb({ cadeia, artigo }: Props) {
  return (
    <nav aria-label="Navegação estrutural" className="mb-5 text-sm">
      <ol className="flex flex-wrap items-center gap-1.5 text-suave">
        <li>
          <Link to="/" className="hover:text-texto hover:underline">
            Início
          </Link>
        </li>
        {cadeia.map((b, i) => {
          const ultimo = i === cadeia.length - 1 && !artigo
          return (
            <li key={b.id} className="flex items-center gap-1.5">
              <ChevronRight className="size-3.5" aria-hidden />
              {ultimo ? (
                <span aria-current="page" className="font-medium text-texto">
                  {b.nome}
                </span>
              ) : (
                <Link
                  to={`/b/${b.id}`}
                  className="hover:text-texto hover:underline"
                >
                  {b.nome}
                </Link>
              )}
            </li>
          )
        })}
        {artigo && (
          <li className="flex items-center gap-1.5">
            <ChevronRight className="size-3.5" aria-hidden />
            <span aria-current="page" className="font-medium text-texto">
              {artigo.titulo}
            </span>
          </li>
        )}
      </ol>
    </nav>
  )
}
