import { useState } from 'react'
import type { DayPoint } from '../utils/metrics'

interface Props {
  pontos: DayPoint[]
}

const formatarDia = (dia: string) =>
  dia.split('-').reverse().slice(0, 2).join('/')

/** Colunas de acessos por dia: série única, com tooltip e visão em tabela. */
export function ViewsChart({ pontos }: Props) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const [tabela, setTabela] = useState(false)
  const maximo = Math.max(1, ...pontos.map((p) => p.count))
  const total = pontos.reduce((soma, p) => soma + p.count, 0)

  return (
    <figure className="viz">
      <figcaption className="mb-2 flex items-center justify-between text-sm">
        <span className="text-suave ">
          Acessos por dia · {total} no período
        </span>
        <button
          type="button"
          onClick={() => setTabela((t) => !t)}
          className="rounded border border-borda px-2 py-0.5 text-xs "
        >
          {tabela ? 'Ver gráfico' : 'Ver tabela'}
        </button>
      </figcaption>

      {tabela ? (
        <table className="w-full max-w-sm text-sm">
          <thead>
            <tr className="text-left text-suave">
              <th className="py-1 font-medium">Dia</th>
              <th className="py-1 text-right font-medium">Acessos</th>
            </tr>
          </thead>
          <tbody>
            {[...pontos].reverse().map((p) => (
              <tr key={p.dia} className="border-t border-borda ">
                <td className="py-1">{formatarDia(p.dia)}</td>
                <td className="py-1 text-right tabular-nums">{p.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div>
          <div className="relative flex">
            <span className="w-8 shrink-0 pr-1 text-right text-xs tabular-nums text-suave">
              {maximo}
            </span>
            <div
              role="img"
              aria-label={`Acessos por dia, de ${formatarDia(pontos[0]?.dia ?? '')} a ${formatarDia(pontos[pontos.length - 1]?.dia ?? '')}, ${total} no total`}
              className="relative flex h-40 flex-1 items-end gap-0.5 border-b border-borda "
              onMouseLeave={() => setAtivo(null)}
            >
              {pontos.map((p, i) => (
                <div
                  key={p.dia}
                  className="flex h-full flex-1 items-end justify-center"
                  onMouseEnter={() => setAtivo(i)}
                >
                  <div
                    className="w-full max-w-6 rounded-t"
                    style={{
                      height: `${(p.count / maximo) * 100}%`,
                      minHeight: p.count > 0 ? 2 : 0,
                      background: 'var(--series-1)',
                      opacity: ativo === null || ativo === i ? 1 : 0.55,
                    }}
                  />
                </div>
              ))}
              {ativo !== null && pontos[ativo] && (
                <div
                  role="status"
                  className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-borda bg-cartao px-2 py-1 text-xs shadow "
                  style={{ left: `${((ativo + 0.5) / pontos.length) * 100}%` }}
                >
                  {formatarDia(pontos[ativo].dia)}:{' '}
                  <strong>{pontos[ativo].count}</strong>
                </div>
              )}
            </div>
          </div>
          <div className="ml-8 mt-1 flex justify-between text-xs text-suave">
            <span>{formatarDia(pontos[0]?.dia ?? '')}</span>
            <span>{formatarDia(pontos[pontos.length - 1]?.dia ?? '')}</span>
          </div>
        </div>
      )}
    </figure>
  )
}
