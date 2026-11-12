import { useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { jaAvaliouBusca, registrarRetornoDaBusca } from '../services/search'

interface Props {
  consulta: string
  produtoId: string
}

/**
 * "Esta busca ajudou?", abaixo dos resultados. Soma um voto anônimo ao termo
 * buscado (não registra quem votou); um voto por termo e sessão.
 */
export function RetornoDaBusca({ consulta, produtoId }: Props) {
  const [respondeu, setRespondeu] = useState(() =>
    jaAvaliouBusca(consulta, produtoId),
  )

  function responder(ajudou: boolean) {
    setRespondeu(true)
    void registrarRetornoDaBusca(consulta, produtoId, ajudou)
  }

  return (
    <div
      className="mt-6 flex flex-wrap items-center gap-3 text-sm text-suave"
      aria-live="polite"
    >
      {respondeu ? (
        <p>Obrigado pela resposta.</p>
      ) : (
        <>
          <p>Esta busca ajudou?</p>
          <button
            type="button"
            className="botao"
            onClick={() => responder(true)}
          >
            <ThumbsUp className="size-4" aria-hidden />
            Sim
          </button>
          <button
            type="button"
            className="botao"
            onClick={() => responder(false)}
          >
            <ThumbsDown className="size-4" aria-hidden />
            Não
          </button>
        </>
      )}
    </div>
  )
}
