import { Link } from 'react-router-dom'
import type { Article, Block } from '../types/content'

interface Props {
  cadeia: Block[]
  artigo?: Pick<Article, 'titulo'>
}

export function Breadcrumb({ cadeia, artigo }: Props) {
  return (
    <nav aria-label="Navegação estrutural" className="mb-4 text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-slate-500 dark:text-slate-400">
        <li>
          <Link to="/" className="hover:underline">
            Início
          </Link>
        </li>
        {cadeia.map((b, i) => {
          const ultimo = i === cadeia.length - 1 && !artigo
          return (
            <li key={b.id} className="flex items-center gap-1">
              <span aria-hidden>/</span>
              {ultimo ? (
                <span
                  aria-current="page"
                  className="text-slate-900 dark:text-slate-100"
                >
                  {b.nome}
                </span>
              ) : (
                <Link to={`/b/${b.id}`} className="hover:underline">
                  {b.nome}
                </Link>
              )}
            </li>
          )
        })}
        {artigo && (
          <li className="flex items-center gap-1">
            <span aria-hidden>/</span>
            <span
              aria-current="page"
              className="text-slate-900 dark:text-slate-100"
            >
              {artigo.titulo}
            </span>
          </li>
        )}
      </ol>
    </nav>
  )
}
