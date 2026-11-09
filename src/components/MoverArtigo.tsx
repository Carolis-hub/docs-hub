import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { moverArtigo } from '../services/governanca'
import { SeletorDeLocal } from './SeletorDeLocal'

interface Props {
  artigo: { id: string; titulo: string; productId: string; blockId: string }
  /** Chamado depois de mover, com o novo bloco. */
  aoMover: (destino: { productId: string; blockId: string }) => void
  aoCancelar: () => void
}

/** Escolhe BU, produto, subproduto e módulo e move o artigo para lá. */
export function MoverArtigo({ artigo, aoMover, aoCancelar }: Props) {
  const { user } = useAuth()
  const [destino, setDestino] = useState<string | null>(artigo.blockId)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function mover() {
    if (!destino || !user) return
    setOcupado(true)
    setErro(null)
    try {
      aoMover(await moverArtigo(artigo.id, destino, user.uid))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível mover.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="space-y-3">
      <SeletorDeLocal
        onChange={setDestino}
        inicial={{ productId: artigo.productId, blockId: artigo.blockId }}
      />
      {erro && (
        <p role="alert" className="text-sm text-perigo">
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className="botao botao-primario"
          disabled={ocupado || !destino || destino === artigo.blockId}
          onClick={() => void mover()}
        >
          {ocupado ? 'Movendo…' : 'Mover para cá'}
        </button>
        <button type="button" className="botao" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
