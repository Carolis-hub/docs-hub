import { useMemo } from 'react'
import { Bot } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { useAsync } from '../../hooks/useAsync'
import { listarRegistros, listarUso } from '../../services/assistenteAdmin'
import { listUsers } from '../../services/users'
import {
  formatarUsd,
  porDia,
  porUsuario,
  qualidade,
  semResposta,
  totalGlobal,
} from '../../utils/assistenteUso'
import { Carregando } from '../../components/Carregando'

const DIAS = 30

function diaAtras(n: number): string {
  const d = new Date(Date.now() - n * 24 * 3600 * 1000)
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

/** Uso, gasto e qualidade do assistente de IA (só admin). */
export function AssistenteUsoPage() {
  const { dados, erro, carregando, recarregar } = useAsync(async () => {
    const [uso, registros, usuarios] = await Promise.all([
      listarUso(diaAtras(DIAS)),
      listarRegistros(),
      listUsers().catch(() => []),
    ])
    return {
      uso,
      registros,
      nomes: new Map(usuarios.map((u) => [u.uid, u.nome])),
    }
  }, [])

  const resumo = useMemo(() => {
    if (!dados) return null
    return {
      total: totalGlobal(dados.uso),
      dias: porDia(dados.uso),
      lacunas: semResposta(dados.registros).slice(0, 15),
      usuarios: porUsuario(dados.registros).slice(0, 10),
      qualidade: qualidade(dados.registros),
      ruins: dados.registros.filter((r) => r.feedback === 'ruim').slice(0, 10),
    }
  }, [dados])

  const nomeDe = (id: string) => dados?.nomes.get(id) ?? id

  return (
    <div>
      <PageHeader
        icone={Bot}
        titulo="Uso do assistente"
        subtitulo={`Últimos ${DIAS} dias. Os valores em dólar são estimativas feitas pelo sistema, não a fatura da Anthropic.`}
        acoes={
          <button type="button" className="botao" onClick={recarregar}>
            Atualizar
          </button>
        }
      />

      {carregando && !dados && <Carregando />}
      {erro && (
        <p role="alert" className="text-perigo">
          {erro}
        </p>
      )}

      {resumo && dados && (
        <div className="space-y-10">
          <section aria-label="Totais" className="grid gap-3 sm:grid-cols-4">
            {[
              ['Perguntas', resumo.total.perguntas.toLocaleString('pt-BR')],
              ['Gasto estimado', formatarUsd(resumo.total.custoUsd)],
              [
                'Tokens (entrada / saída)',
                `${resumo.total.tokensEntrada.toLocaleString('pt-BR')} / ${resumo.total.tokensSaida.toLocaleString('pt-BR')}`,
              ],
              [
                'Com resposta na documentação',
                resumo.qualidade.respondidas
                  ? `${Math.round((resumo.qualidade.encontraram / resumo.qualidade.respondidas) * 100)}%`
                  : '—',
              ],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="cartao p-4">
                <p className="text-xs text-suave">{rotulo}</p>
                <p className="mt-1 text-xl font-semibold">{valor}</p>
              </div>
            ))}
          </section>

          <section aria-label="Avaliações">
            <h2 className="mb-2 text-lg font-semibold">
              Avaliações dos usuários
            </h2>
            <p className="text-sm text-suave">
              {resumo.qualidade.uteis} útil
              {resumo.qualidade.uteis === 1 ? '' : 'eis'} ·{' '}
              {resumo.qualidade.ruins} ruim
              {resumo.qualidade.ruins === 1 ? '' : 'ns'} (de{' '}
              {resumo.qualidade.respondidas} pergunta
              {resumo.qualidade.respondidas === 1 ? '' : 's'} registradas)
            </p>
            {resumo.ruins.length > 0 && (
              <ul className="mt-3 divide-y divide-borda rounded-lg border border-borda bg-cartao text-sm">
                {resumo.ruins.map((r) => (
                  <li key={r.id} className="px-4 py-2">
                    {r.pergunta}{' '}
                    <span className="text-suave">· {nomeDe(r.uid)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Perguntas sem resposta">
            <h2 className="mb-2 text-lg font-semibold">
              Perguntas que a documentação não respondeu
            </h2>
            {resumo.lacunas.length === 0 ? (
              <p className="text-sm text-suave">Nenhuma até agora.</p>
            ) : (
              <>
                <p className="mb-2 text-sm text-suave">
                  Boas pistas do que falta documentar (ou do que não está sendo
                  achado).
                </p>
                <ul className="divide-y divide-borda rounded-lg border border-borda bg-cartao text-sm">
                  {resumo.lacunas.map((g) => (
                    <li
                      key={g.pergunta}
                      className="flex justify-between gap-3 px-4 py-2"
                    >
                      <span>{g.pergunta}</span>
                      <span className="shrink-0 text-suave">{g.vezes}×</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-label="Uso por dia">
              <h2 className="mb-2 text-lg font-semibold">Por dia</h2>
              {resumo.dias.length === 0 ? (
                <p className="text-sm text-suave">Nenhum uso no período.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-suave">
                    <tr>
                      <th className="py-1">Dia</th>
                      <th>Perguntas</th>
                      <th className="text-right">Gasto estimado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.dias.map((d) => (
                      <tr key={d.id} className="border-t border-borda">
                        <td className="py-1">
                          {d.dia.split('-').reverse().join('/')}
                        </td>
                        <td>{d.perguntas ?? 0}</td>
                        <td className="text-right">
                          {formatarUsd(d.custoUsd ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <section aria-label="Uso por pessoa">
              <h2 className="mb-2 text-lg font-semibold">Quem mais usa</h2>
              {resumo.usuarios.length === 0 ? (
                <p className="text-sm text-suave">Ninguém usou ainda.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-suave">
                    <tr>
                      <th className="py-1">Pessoa</th>
                      <th>Perguntas</th>
                      <th className="text-right">Gasto estimado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.usuarios.map((u) => (
                      <tr key={u.uid} className="border-t border-borda">
                        <td className="py-1">{nomeDe(u.uid)}</td>
                        <td>{u.perguntas}</td>
                        <td className="text-right">
                          {formatarUsd(u.custoUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
