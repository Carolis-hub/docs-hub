import { ExternalLink } from 'lucide-react'
import type { Ficha, SecaoFicha } from '../types/content'
import { urlSegura } from '../utils/ficha'
import { TextoRico } from './TextoRico'

function Celula({ texto }: { texto: string }) {
  // Dentro da tabela só interessa o negrito (versões homologadas); links viram texto.
  const partes = texto.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} className="text-destaque">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

function Secao({ secao }: { secao: SecaoFicha }) {
  const largura = secao.tipo === 'tabela' ? 'lg:col-span-2' : ''
  return (
    <section
      aria-label={secao.titulo || undefined}
      className={`cartao min-w-0 p-5 ${largura}`}
    >
      {secao.titulo && (
        <h3 className="text-lg font-extrabold tracking-tight">
          {secao.titulo}
        </h3>
      )}
      {secao.texto && (
        <TextoRico
          texto={secao.texto}
          className="mt-2 text-sm leading-relaxed text-texto/80"
        />
      )}
      {secao.tipo === 'tabela' && secao.colunas.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-borda">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="bg-bloco">
                {secao.colunas.map((c, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="px-3 py-2 text-left font-semibold"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {secao.linhas.map((l, i) => (
                <tr key={i} className="border-t border-borda">
                  {secao.colunas.map((_, j) => (
                    <td key={j} className="px-3 py-2">
                      <Celula texto={l[j] ?? ''} />
                    </td>
                  ))}
                </tr>
              ))}
              {secao.linhas.length === 0 && (
                <tr>
                  <td
                    colSpan={secao.colunas.length}
                    className="px-3 py-3 text-suave"
                  >
                    Sem versões cadastradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {secao.tipo === 'links' && secao.itens.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {secao.itens.map((item, i) => {
            const url = urlSegura(item.url)
            return (
              <li key={i}>
                {url ? (
                  <a
                    href={url}
                    target={url.startsWith('mailto:') ? undefined : '_blank'}
                    rel="noopener noreferrer"
                    className="botao"
                  >
                    {item.rotulo}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : (
                  <span className="selo">{item.rotulo}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Informações do produto que mudam a cada liberação (compatibilidade, instaladores…). */
export function FichaDoProduto({ ficha }: { ficha: Ficha }) {
  if (ficha.secoes.length === 0) return null
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {ficha.secoes.map((s) => (
        <Secao key={s.id} secao={s} />
      ))}
    </div>
  )
}
