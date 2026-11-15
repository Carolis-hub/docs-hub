export type UserRole = 'reader' | 'admin'

export interface AppUser {
  uid: string
  nome: string
  email: string
  role: UserRole
  produtosPermitidos: string[]
  verTecnico: boolean
  /**
   * BUs liberadas (ids de `unidades`, mais `sem-unidade` para os produtos sem
   * BU). É a escolha feita na tela; `produtosPermitidos` é calculado a partir
   * dela, porque é o campo que as regras do Firestore leem. Contas antigas não
   * têm este campo.
   */
  unidadesPermitidas?: string[]
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
> & {
  senha: string
  permissoes?: Record<string, boolean>
  unidadesPermitidas?: string[]
}

export type UserPatch = Pick<
  AppUser,
  'nome' | 'role' | 'produtosPermitidos' | 'verTecnico'
> & { permissoes?: Record<string, boolean>; unidadesPermitidas?: string[] }
