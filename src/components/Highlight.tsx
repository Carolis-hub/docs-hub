import type { TrechoParte } from '../utils/search'

export function Highlight({ partes }: { partes: TrechoParte[] }) {
  return (
    <>
      {partes.map((p, i) =>
        p.destaque ? (
          <mark
            key={i}
            className="rounded bg-yellow-200 px-0.5 text-slate-900 dark:bg-yellow-500/40 dark:text-slate-100"
          >
            {p.texto}
          </mark>
        ) : (
          <span key={i}>{p.texto}</span>
        ),
      )}
    </>
  )
}
