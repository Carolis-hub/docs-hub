import { Link } from 'react-router-dom'
import { lerMarkdown, type TrechoMd } from '../utils/markdownRodape'
import { ehLinkInterno } from '../utils/rodape'

export function LinkDoRodape({
  url,
  className = '',
  children,
}: {
  url: string
  className?: string
  children: React.ReactNode
}) {
  if (ehLinkInterno(url)) {
    return (
      <Link to={url} className={className}>
        {children}
      </Link>
    )
  }
  const externo = /^https?:/i.test(url)
  return (
    <a
      href={url}
      className={className}
      {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  )
}

function Trechos({ trechos }: { trechos: TrechoMd[] }) {
  return (
    <>
      {trechos.map((t, i) => {
        switch (t.tipo) {
          case 'texto':
            return <span key={i}>{t.texto}</span>
          case 'negrito':
            return (
              <strong key={i}>
                <Trechos trechos={t.trechos} />
              </strong>
            )
          case 'italico':
            return (
              <em key={i}>
                <Trechos trechos={t.trechos} />
              </em>
            )
          case 'codigo':
            return (
              <code key={i} className="rounded bg-bloco px-1 text-[0.9em]">
                {t.texto}
              </code>
            )
          case 'link':
            return (
              <LinkDoRodape
                key={i}
                url={t.url}
                className="text-destaque underline"
              >
                <Trechos trechos={t.trechos} />
              </LinkDoRodape>
            )
        }
      })}
    </>
  )
}

/** Desenha o Markdown do rodapé sem `innerHTML`: HTML digitado aparece como texto. */
export function MarkdownRodape({ texto }: { texto: string }) {
  const blocos = lerMarkdown(texto)
  if (blocos.length === 0) return null
  return (
    <div className="space-y-1.5">
      {blocos.map((b, i) => {
        if (b.tipo === 'titulo') {
          return (
            <p key={i} className="font-semibold text-texto">
              <Trechos trechos={b.trechos} />
            </p>
          )
        }
        if (b.tipo === 'lista') {
          const Lista = b.ordenada ? 'ol' : 'ul'
          return (
            <Lista
              key={i}
              className={`ml-5 space-y-0.5 ${b.ordenada ? 'list-decimal' : 'list-disc'}`}
            >
              {b.itens.map((it, j) => (
                <li key={j}>
                  <Trechos trechos={it} />
                </li>
              ))}
            </Lista>
          )
        }
        return (
          <p key={i}>
            <Trechos trechos={b.trechos} />
          </p>
        )
      })}
    </div>
  )
}
