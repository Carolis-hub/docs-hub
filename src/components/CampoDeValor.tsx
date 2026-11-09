import type { SecaoFicha } from '../types/content'
import { LIMITES_FICHA } from '../utils/ficha'

interface Props {
  secao: SecaoFicha
  /** Valor em texto: a tabela (primeira linha = colunas) ou os links (um por linha). */
  valor: string
  aoMudarTexto: (texto: string) => void
  aoMudarValor: (valor: string) => void
}

/**
 * O campo onde se escreve o valor de uma das 5 opções do produto: o mesmo
 * componente para todas (texto de apoio e a tabela de versões ou os links).
 */
export function CampoDeValor({
  secao,
  valor,
  aoMudarTexto,
  aoMudarValor,
}: Props) {
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        Texto de apoio (opcional)
        <textarea
          className="campo mt-1"
          rows={3}
          maxLength={LIMITES_FICHA.texto}
          value={secao.texto}
          aria-label={`Texto de apoio de ${secao.titulo}`}
          onChange={(e) => aoMudarTexto(e.target.value)}
        />
      </label>
      {secao.tipo === 'tabela' && (
        <label className="block text-sm">
          Tabela de {secao.titulo} (primeira linha = colunas)
          <textarea
            className="campo mt-1 font-mono text-xs"
            rows={7}
            value={valor}
            onChange={(e) => aoMudarValor(e.target.value)}
          />
        </label>
      )}
      {secao.tipo === 'links' && (
        <label className="block text-sm">
          Links de {secao.titulo} (um por linha: Rótulo | https://…)
          <textarea
            className="campo mt-1 font-mono text-xs"
            rows={4}
            value={valor}
            onChange={(e) => aoMudarValor(e.target.value)}
          />
        </label>
      )}
    </div>
  )
}
