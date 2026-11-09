import type { ConfigAside, PreferenciasUsuario } from '../types/preferencias'
import type { EntradaAside, ModoAsideLegado } from './aside'

export const ASIDE_PADRAO: ConfigAside = {
  visivel: true,
  manual: true,
  busca: true,
}

export const PREFERENCIAS_PADRAO: PreferenciasUsuario = { aside: ASIDE_PADRAO }

/** As entradas da aside, na ordem em que aparecem. */
export const ENTRADAS_DA_ASIDE: {
  id: EntradaAside
  rotulo: string
}[] = [
  { id: 'manual', rotulo: 'Manual de produtos' },
  { id: 'busca', rotulo: 'Busca/consulta com IA' },
]

const bool = (v: unknown, padrao: boolean) =>
  typeof v === 'boolean' ? v : padrao

/** Aceita qualquer coisa vinda do banco e devolve um modelo completo e válido. */
export function normalizarPreferencias(raw: unknown): PreferenciasUsuario {
  const aside = (raw as { aside?: Record<string, unknown> } | null)?.aside
  return {
    aside: {
      visivel: bool(aside?.visivel, ASIDE_PADRAO.visivel),
      manual: bool(aside?.manual, ASIDE_PADRAO.manual),
      busca: bool(aside?.busca, ASIDE_PADRAO.busca),
    },
  }
}

/** Converte o modo antigo (toda, só manual, só busca, oculta) para o modelo novo. */
export function deModoLegado(modo: unknown): PreferenciasUsuario | null {
  const casos: Record<ModoAsideLegado, ConfigAside> = {
    toda: { visivel: true, manual: true, busca: true },
    manual: { visivel: true, manual: true, busca: false },
    busca: { visivel: true, manual: false, busca: true },
    oculta: { visivel: false, manual: true, busca: true },
  }
  return typeof modo === 'string' && modo in casos
    ? { aside: casos[modo as ModoAsideLegado] }
    : null
}

/** Quais entradas a aside mostra: nenhuma se estiver oculta ou sem entradas marcadas. */
export function entradasDaAside(config: ConfigAside): EntradaAside[] {
  if (!config.visivel) return []
  return ENTRADAS_DA_ASIDE.filter((e) => config[e.id]).map((e) => e.id)
}
