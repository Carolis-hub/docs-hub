import { lerTextoRico } from '../utils/textoRico'

/** Texto curto com **negrito** e links, em parágrafos. */
export function TextoRico({
  texto,
  className = '',
}: {
  texto: string
  className?: string
}) {
  const paragrafos = lerTextoRico(texto)
  if (paragrafos.length === 0) return null
  return (
    <div className={`space-y-2 ${className}`}>
      {paragrafos.map((p, i) => (
        <p key={i}>
          {p.map((x, j) =>
            x.tipo === 'negrito' ? (
              <strong key={j}>{x.texto}</strong>
            ) : x.tipo === 'link' ? (
              <a
                key={j}
                href={x.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-destaque underline break-all"
              >
                {x.texto}
              </a>
            ) : (
              <span key={j}>{x.texto}</span>
            ),
          )}
        </p>
      ))}
    </div>
  )
}
