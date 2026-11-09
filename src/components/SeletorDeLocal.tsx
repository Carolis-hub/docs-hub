import { useEffect, useMemo, useState } from 'react'
import { useAsync } from '../hooks/useAsync'
import { listProducts, listProductTree } from '../services/blocks'
import { listUnidades } from '../services/unidades'

interface Props {
  /** Bloco de destino escolhido (o mais fundo selecionado) ou `null`. */
  onChange: (blockId: string | null) => void
  /** Começa já posicionado num bloco existente (para mover um artigo). */
  inicial?: { productId: string; blockId: string }
}

const rotulo = 'block text-sm'

/**
 * Escolha em cascata de onde o artigo fica: BU, produto, subproduto e módulo.
 * O destino é o nível mais fundo escolhido.
 */
export function SeletorDeLocal({ onChange, inicial }: Props) {
  const { dados } = useAsync(async () => {
    const [unidades, produtos] = await Promise.all([
      listUnidades(),
      listProducts(),
    ])
    return { unidades, produtos }
  }, [])
  const [unidadeId, setUnidadeId] = useState('')
  const [produtoId, setProdutoId] = useState(inicial?.productId ?? '')
  const [subId, setSubId] = useState('')
  const [moduloId, setModuloId] = useState('')
  // Enquanto a pessoa não mexe, vale o bloco inicial (pode ser mais fundo que o módulo).
  const [tocou, setTocou] = useState(false)
  const [posicionado, setPosicionado] = useState(!inicial)
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

  // Posiciona BU, subproduto e módulo a partir do bloco inicial, uma vez só.
  useEffect(() => {
    if (!inicial || posicionado || !dados || !arvore || arvore.length === 0)
      return
    const porId = new Map(arvore.map((b) => [b.id, b]))
    const cadeia: string[] = []
    let atual = porId.get(inicial.blockId)
    while (atual && atual.parentId !== null) {
      cadeia.unshift(atual.id)
      atual = porId.get(atual.parentId)
    }
    setUnidadeId(
      dados.produtos.find((p) => p.id === produtoId)?.unidadeId ?? '',
    )
    setSubId(cadeia[0] ?? '')
    setModuloId(cadeia[1] ?? '')
    setPosicionado(true)
  }, [inicial, posicionado, dados, arvore, produtoId])

  useEffect(() => {
    if (!posicionado) return
    if (inicial && !tocou) {
      onChange(inicial.blockId)
      return
    }
    onChange(moduloId || subId || produtoId || null)
  }, [moduloId, subId, produtoId, onChange, inicial, tocou, posicionado])

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
              setTocou(true)
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
            setTocou(true)
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
              setTocou(true)
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
            onChange={(e) => {
              setTocou(true)
              setModuloId(e.target.value)
            }}
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
