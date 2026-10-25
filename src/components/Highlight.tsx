import type { TrechoParte } from '../utils/search'

export function Highlight({ partes }: { partes: TrechoParte[] }) {
  return (
    <>
      {partes.map((p, i) =>
        p.destaque ? (
          <mark key={i} className="rounded bg-ambar/30 px-0.5 text-texto ">
            {p.texto}
          </mark>
        ) : (
          <span key={i}>{p.texto}</span>
        ),
      )}
    </>
  )
}
