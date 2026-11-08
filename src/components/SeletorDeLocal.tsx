import { useEffect, useMemo, useState } from 'react'
import { useAsync } from '../hooks/useAsync'
import { listProducts, listProductTree } from '../services/blocks'
import { listUnidades } from '../services/unidades'

interface Props {
  /** Bloco de destino escolhido (o mais fundo selecionado) ou `null`. */
  onChange: (blockId: string | null) => void
}

const rotulo = 'block text-sm'

/**
 * Escolha em cascata de onde o artigo fica: BU, produto, subproduto e módulo.
 * O destino é o nível mais fundo escolhido.
 */
export function SeletorDeLocal({ onChange }: Props) {
  const { dados } = useAsync(async () => {
    const [unidades, produtos] = await Promise.all([
      listUnidades(),
      listProducts(),
    ])
    return { unidades, produtos }
  }, [])
  const [unidadeId, setUnidadeId] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [subId, setSubId] = useState('')
  const [moduloId, setModuloId] = useState('')
  const { dados: arvore } = useAsync(
    async () => (produtoId ? await listProductTree(produtoId) : []),
    [produtoId],
  )

  const produtos = useMemo(
    () =>
      (dados?.produtos ?? []).filter(
        (p) => !unidadeId || p.unidadeId === unidadeId,
      ),
    [dados, unidadeId],
  )
  const subs = (arvore ?? []).filter((b) => b.parentId === produtoId)
  const modulos = (arvore ?? []).filter(
    (b) => subId !== '' && b.parentId === subId,
  )

  useEffect(() => {
    onChange(moduloId || subId || produtoId || null)
  }, [moduloId, subId, produtoId, onChange])

  return (
    <fieldset className="cartao grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <legend className="px-1 text-sm font-medium">Onde fica o artigo</legend>
      {(dados?.unidades.length ?? 0) > 0 && (
        <label className={rotulo}>
          BU
          <select
            className="campo mt-1"
            value={unidadeId}
            onChange={(e) => {
              setUnidadeId(e.target.value)
              setProdutoId('')
              setSubId('')
              setModuloId('')
            }}
          >
            <option value="">Todas</option>
            {dados?.unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={rotulo}>
        Produto
        <select
          className="campo mt-1"
          value={produtoId}
          onChange={(e) => {
            setProdutoId(e.target.value)
            setSubId('')
            setModuloId('')
          }}
        >
          <option value="">Escolha…</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>
      {subs.length > 0 && (
        <label className={rotulo}>
          Subproduto
          <select
            className="campo mt-1"
            value={subId}
            onChange={(e) => {
              setSubId(e.target.value)
              setModuloId('')
            }}
          >
            <option value="">No próprio produto</option>
            {subs.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      {modulos.length > 0 && (
        <label className={rotulo}>
          Módulo
          <select
            className="campo mt-1"
            value={moduloId}
            onChange={(e) => setModuloId(e.target.value)}
          >
            <option value="">No próprio subproduto</option>
            {modulos.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </label>
      )}
    </fieldset>
  )
}
