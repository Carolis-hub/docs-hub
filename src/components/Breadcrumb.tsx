import { Link } from 'react-router-dom'

export interface BreadcrumbItem {
  label: string
  to?: string
  onClick?: () => void
}

interface BreadcrumbProps {
  itens: BreadcrumbItem[]
  raiz?: { label: string; to?: string; onClick?: () => void }
}

export function Breadcrumb({
  itens,
  raiz = { label: 'Início', to: '/' },
}: BreadcrumbProps) {
  return (
    <nav aria-label="Trilha de navegação" className="mb-6 text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-slate-500 dark:text-slate-400">
        <li>
          {raiz.to ? (
            <Link to={raiz.to} className="hover:underline">
              {raiz.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={raiz.onClick}
              className="hover:underline"
            >
              {raiz.label}
            </button>
          )}
        </li>
        {itens.map((item, indice) => (
          <li
            key={`${item.label}-${indice}`}
            className="flex items-center gap-1"
          >
            <span aria-hidden="true">/</span>
            {item.to ? (
              <Link to={item.to} className="hover:underline">
                {item.label}
              </Link>
            ) : item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                className="hover:underline"
              >
                {item.label}
              </button>
            ) : (
              <span
                className="text-slate-700 dark:text-slate-200"
                aria-current="page"
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
