/** Entradas da aside esquerda (visível só para administradores). */
export type EntradaAside = 'manual' | 'busca'

/** Modo escolhido por cada administrador em Configurações. */
export type ModoAside = 'toda' | 'manual' | 'busca' | 'oculta'

export const MODOS_ASIDE: { valor: ModoAside; rotulo: string }[] = [
  { valor: 'toda', rotulo: 'Visualizar toda a aside' },
  { valor: 'manual', rotulo: 'Apenas manual de produtos' },
  { valor: 'busca', rotulo: 'Apenas busca/consulta com IA' },
  { valor: 'oculta', rotulo: 'Ocultar a aside' },
]

const VALIDOS = new Set<string>(MODOS_ASIDE.map((m) => m.valor))

export function modoAsideValido(v: unknown): ModoAside {
  return typeof v === 'string' && VALIDOS.has(v) ? (v as ModoAside) : 'toda'
}

/** Quais entradas aparecem. Quem não é admin nunca vê a aside. */
export function entradasVisiveis(
  modo: ModoAside,
  isAdmin: boolean,
): EntradaAside[] {
  if (!isAdmin || modo === 'oculta') return []
  if (modo === 'manual') return ['manual']
  if (modo === 'busca') return ['busca']
  return ['manual', 'busca']
}

export const chaveModoAside = (uid: string) => `docshub.aside.${uid}`
