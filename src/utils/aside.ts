/** Entradas da aside esquerda. */
export type EntradaAside = 'manual' | 'busca'

/** Modo da aside que cada pessoa guardava neste navegador (antes de ir para a conta). */
export type ModoAsideLegado = 'toda' | 'manual' | 'busca' | 'oculta'

export const chaveModoLegado = (uid: string) => `docshub.aside.${uid}`
