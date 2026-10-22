export type UserRole = 'reader' | 'admin'

export interface AppUser {
  uid: string
  nome: string
  email: string
  role: UserRole
  produtosPermitidos: string[]
  verTecnico: boolean
  /** `false` desativa a conta: as regras negam todo o acesso. */
  ativo?: boolean
}

export type NewUserInput = Pick<
  AppUser,
  'nome' | 'email' | 'role' | 'produtosPermitidos' | 'verTecnico'
> & { senha: string }

export type UserPatch = Pick<
  AppUser,
  'nome' | 'role' | 'produtosPermitidos' | 'verTecnico'
>
