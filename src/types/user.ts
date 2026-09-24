export type UserRole = 'reader' | 'admin'

export interface AppUser {
  uid: string
  nome: string
  email: string
  role: UserRole
  produtosPermitidos: string[]
  verTecnico: boolean
}
