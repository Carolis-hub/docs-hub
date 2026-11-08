/**
 * Chave da API de IA de cada usuário. Fica só no navegador (localStorage), por
 * usuário: nunca vai para o Firestore. O servidor do assistente a recebe a cada
 * pergunta, usa na hora e não guarda nem registra.
 */
export const chaveArmazenada = (uid: string) => `docshub.chaveIA.${uid}`

/** Aceita só uma linha, sem espaços, de tamanho razoável. */
export function chaveIAValida(chave: string): boolean {
  return /^[^\s]{20,300}$/.test(chave.trim())
}

/** Mostra só o começo e o fim, para conferir qual chave está guardada. */
export function mascararChave(chave: string): string {
  const c = chave.trim()
  return c.length <= 12 ? '••••' : `${c.slice(0, 7)}…${c.slice(-4)}`
}

export function lerChaveIA(uid: string | undefined): string {
  if (!uid) return ''
  try {
    return localStorage.getItem(chaveArmazenada(uid)) ?? ''
  } catch {
    return ''
  }
}

export function gravarChaveIA(uid: string, chave: string): void {
  try {
    if (chave.trim()) localStorage.setItem(chaveArmazenada(uid), chave.trim())
    else localStorage.removeItem(chaveArmazenada(uid))
  } catch {
    /* sem armazenamento: a chave não fica guardada */
  }
}
