import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { Ficha, SecaoFicha } from '../types/content'
import {
  LIMITES_FICHA,
  fichaModelo,
  linksParaTexto,
  secaoVazia,
  tabelaParaTexto,
  textoParaLinks,
  textoParaTabela,
  type TipoSecao,
} from '../utils/ficha'

/** Seção em edição: tabelas e links ficam como texto até salvar. */
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

const ROTULO_TIPO: Record<TipoSecao, string> = {
  texto: 'Texto',
  tabela: 'Tabela',
  links: 'Links',
}

interface Props {
  inicial: Ficha
  aoSalvar: (ficha: Ficha) => Promise<void>
  aoCancelar: () => void
}

export function EditorDaFicha({ inicial, aoSalvar, aoCancelar }: Props) {
  const [edicoes, setEdicoes] = useState<Edicao[]>(() =>
    inicial.secoes.map(paraEdicao),
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const alterar = (id: string, mudanca: Partial<Edicao>) =>
    setEdicoes((atual) =>
      atual.map((e) => (e.secao.id === id ? { ...e, ...mudanca } : e)),
    )
  const alterarSecao = (id: string, campos: Record<string, string>) =>
    setEdicoes((atual) =>
      atual.map((e) =>
        e.secao.id === id
          ? { ...e, secao: { ...e.secao, ...campos } as SecaoFicha }
          : e,
      ),
    )
  const mover = (id: string, delta: -1 | 1) =>
    setEdicoes((atual) => {
      const i = atual.findIndex((e) => e.secao.id === id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= atual.length) return atual
      const novo = [...atual]
      const [item] = novo.splice(i, 1)
      novo.splice(j, 0, item as Edicao)
      return novo
    })

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
        Use <code>**texto**</code> para negrito (versões homologadas) e escreva
        endereços completos (https://…) para virarem link. Nas tabelas, a
        primeira linha são as colunas e as células ficam separadas por{' '}
        <code>|</code>.
      </p>

      {edicoes.map(({ secao, tabela, links }, i) => (
        <fieldset
          key={secao.id}
          className="space-y-3 rounded-xl border border-borda p-4"
        >
          <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
            {ROTULO_TIPO[secao.tipo]}
          </legend>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[200px] flex-1 text-sm">
              Título
              <input
                className="campo mt-1"
                value={secao.titulo}
                maxLength={LIMITES_FICHA.titulo}
                onChange={(e) =>
                  alterarSecao(secao.id, { titulo: e.target.value })
                }
              />
            </label>
            <button
              type="button"
              className="botao-icone"
              aria-label={`Subir a seção ${secao.titulo || i + 1}`}
              disabled={i === 0}
              onClick={() => mover(secao.id, -1)}
            >
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className="botao-icone"
              aria-label={`Descer a seção ${secao.titulo || i + 1}`}
              disabled={i === edicoes.length - 1}
              onClick={() => mover(secao.id, 1)}
            >
              <ArrowDown className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className="botao-icone hover:text-perigo"
              aria-label={`Remover a seção ${secao.titulo || i + 1}`}
              onClick={() =>
                setEdicoes((atual) =>
                  atual.filter((e) => e.secao.id !== secao.id),
                )
              }
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
          <label className="block text-sm">
            {secao.tipo === 'texto' ? 'Texto' : 'Texto de apoio (opcional)'}
            <textarea
              className="campo mt-1"
              rows={secao.tipo === 'texto' ? 5 : 3}
              maxLength={LIMITES_FICHA.texto}
              value={secao.texto}
              onChange={(e) =>
                alterarSecao(secao.id, { texto: e.target.value })
              }
            />
          </label>
          {secao.tipo === 'tabela' && (
            <label className="block text-sm">
              Tabela (primeira linha = colunas)
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
              Links (um por linha: Rótulo | https://…)
              <textarea
                className="campo mt-1 font-mono text-xs"
                rows={5}
                value={links}
                onChange={(e) => alterar(secao.id, { links: e.target.value })}
              />
            </label>
          )}
        </fieldset>
      ))}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Adicionar">
        {(['texto', 'tabela', 'links'] as TipoSecao[]).map((tipo) => (
          <button
            key={tipo}
            type="button"
            className="botao"
            disabled={edicoes.length >= LIMITES_FICHA.secoes}
            onClick={() =>
              setEdicoes((atual) => [...atual, paraEdicao(secaoVazia(tipo))])
            }
          >
            <Plus className="size-4" aria-hidden />
            {ROTULO_TIPO[tipo]}
          </button>
        ))}
        {edicoes.length === 0 && (
          <button
            type="button"
            className="botao"
            onClick={() => setEdicoes(fichaModelo().secoes.map(paraEdicao))}
          >
            Começar pelo modelo (compatibilidade, instaladores, release notes e
            contato)
          </button>
        )}
      </div>

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
