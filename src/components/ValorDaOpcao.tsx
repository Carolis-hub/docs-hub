import { ExternalLink } from 'lucide-react'
import type { SecaoFicha } from '../types/content'
import { temConteudo, urlSegura } from '../utils/ficha'
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

function Conteudo({ secao }: { secao: SecaoFicha }) {
  return (
    <div className="min-w-0">
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
    </div>
  )
}

/**
 * O campo que mostra o valor de uma das 5 opções do produto: o mesmo
 * componente para todas (título, texto de apoio e a tabela de versões ou os
 * links), com o mesmo aviso quando a opção ainda não tem valor.
 */
export function ValorDaOpcao({
  secao,
  admin = false,
}: {
  secao: SecaoFicha
  admin?: boolean
}) {
  if (temConteudo(secao)) return <Conteudo secao={secao} />
  return (
    <div className="min-w-0">
      {secao.titulo && (
        <h3 className="text-lg font-extrabold tracking-tight">
          {secao.titulo}
        </h3>
      )}
      <p className="mt-2 text-sm italic text-suave">
        {admin
          ? 'Esta opção ainda não tem conteúdo. Use "Editar informações" para preencher.'
          : 'Sem conteúdo por enquanto.'}
      </p>
    </div>
  )
}
