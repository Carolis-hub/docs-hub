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
  /**
   * Acesso a cada funcionalidade (veja `utils/permissoes.ts`). O que não
   * estiver gravado vale como liberado, então contas antigas não perdem nada.
   */
  permissoes?: Record<string, boolean>
}

export type NewUserInput = Pick<
  AppUser,
  'nome' | 'email' | 'role' | 'produtosPermitidos' | 'verTecnico'
> & { senha: string; permissoes?: Record<string, boolean> }

export type UserPatch = Pick<
  AppUser,
  'nome' | 'role' | 'produtosPermitidos' | 'verTecnico'
> & { permissoes?: Record<string, boolean> }
