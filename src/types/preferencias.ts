/** Configurações da aside esquerda de uma pessoa. */
export interface ConfigAside {
  /** Mostrar a aside. */
  visivel: boolean
  /** Entrada "Manual de produtos". */
  manual: boolean
  /** Entrada "Buscar Artigo". */
  busca: boolean
}

/**
 * Modelo de configurações de usuário: cada pessoa tem o seu, guardado na conta
 * (`preferenciasUsuario/{uid}`), então vale em qualquer navegador. Novos grupos
 * de configuração entram aqui, ao lado de `aside`.
 */
export interface PreferenciasUsuario {
  aside: ConfigAside
}
