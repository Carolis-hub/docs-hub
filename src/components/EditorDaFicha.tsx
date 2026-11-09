import { useState } from 'react'
import type { Ficha, SecaoFicha } from '../types/content'
import {
  LIMITES_FICHA,
  completarFicha,
  linksParaTexto,
  tabelaParaTexto,
  textoParaLinks,
  textoParaTabela,
} from '../utils/ficha'

/** Opção em edição: tabela e links ficam como texto até salvar. */
interface Edicao {
  secao: SecaoFicha
  tabela: string
  links: string
}

const paraEdicao = (secao: SecaoFicha): Edicao => ({
  secao,
  tabela:
    secao.tipo === 'tabela' ? tabelaParaTexto(secao.colunas, secao.linhas) : '',
  links: secao.tipo === 'links' ? linksParaTexto(secao.itens) : '',
})

function dasEdicoes(edicoes: Edicao[]): Ficha {
  return {
    secoes: edicoes.map(({ secao, tabela, links }) => {
      if (secao.tipo === 'tabela') {
        return { ...secao, ...textoParaTabela(tabela) }
      }
      if (secao.tipo === 'links') {
        return { ...secao, itens: textoParaLinks(links) }
      }
      return secao
    }),
  }
}

interface Props {
  inicial: Ficha
  aoSalvar: (ficha: Ficha) => Promise<void>
  aoCancelar: () => void
}

/**
 * Edita o conteúdo das 5 opções fixas do produto. Títulos, tipos e ordem são
 * fixos: só o texto, as tabelas e os links mudam a cada liberação.
 */
export function EditorDaFicha({ inicial, aoSalvar, aoCancelar }: Props) {
  const [edicoes, setEdicoes] = useState<Edicao[]>(() =>
    completarFicha(inicial).secoes.map(paraEdicao),
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const alterar = (id: string, mudanca: Partial<Edicao>) =>
    setEdicoes((atual) =>
      atual.map((e) => (e.secao.id === id ? { ...e, ...mudanca } : e)),
    )

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      await aoSalvar(dasEdicoes(edicoes))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form
      aria-label="Editar informações do produto"
      onSubmit={(e) => {
        e.preventDefault()
        void salvar()
      }}
      className="cartao space-y-4 p-5"
    >
      <p className="text-sm text-suave">
        As 5 opções são fixas; edite o conteúdo de cada uma. Use{' '}
        <code>**texto**</code> para negrito (versões homologadas) e escreva
        endereços completos (https://…) para virarem link. Nas tabelas, a
        primeira linha são as colunas e as células ficam separadas por{' '}
        <code>|</code>.
      </p>

      {edicoes.map(({ secao, tabela, links }) => (
        <fieldset
          key={secao.id}
          className="space-y-3 rounded-xl border border-borda p-4"
        >
          <legend className="px-1 text-sm font-bold uppercase tracking-wide text-destaque">
            {secao.titulo}
          </legend>
          <label className="block text-sm">
            Texto de apoio (opcional)
            <textarea
              className="campo mt-1"
              rows={3}
              maxLength={LIMITES_FICHA.texto}
              value={secao.texto}
              aria-label={`Texto de apoio de ${secao.titulo}`}
              onChange={(e) =>
                alterar(secao.id, {
                  secao: { ...secao, texto: e.target.value },
                })
              }
            />
          </label>
          {secao.tipo === 'tabela' && (
            <label className="block text-sm">
              Tabela de {secao.titulo} (primeira linha = colunas)
              <textarea
                className="campo mt-1 font-mono text-xs"
                rows={7}
                value={tabela}
                onChange={(e) => alterar(secao.id, { tabela: e.target.value })}
              />
            </label>
          )}
          {secao.tipo === 'links' && (
            <label className="block text-sm">
              Links de {secao.titulo} (um por linha: Rótulo | https://…)
              <textarea
                className="campo mt-1 font-mono text-xs"
                rows={4}
                value={links}
                onChange={(e) => alterar(secao.id, { links: e.target.value })}
              />
            </label>
          )}
        </fieldset>
      ))}

      {erro && (
        <p role="alert" className="text-sm text-perigo">
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          className="botao botao-primario"
          disabled={salvando}
        >
          {salvando ? 'Salvando…' : 'Salvar informações'}
        </button>
        <button type="button" className="botao" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
