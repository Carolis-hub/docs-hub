/** Módulo "Governança", dentro de Configurações (só administradores). */
export const MODULO_GOVERNANCA: {
  para: string
  rotulo: string
  descricao: string
}[] = [
  {
    para: '/admin/revisao',
    rotulo: 'Revisão',
    descricao: 'Fila de aprovação: o que vai ao ar e alterações pendentes.',
  },
  {
    para: '/admin/sincronizacao',
    rotulo: 'Sincronização',
    descricao: 'O que está chegando das pastas de documentos.',
  },
  {
    para: '/admin/auditoria',
    rotulo: 'Auditoria',
    descricao: 'Registro de quem fez o quê e quando.',
  },
]

export const ROTAS_CONFIGURACOES = [
  '/admin/configuracoes',
  ...MODULO_GOVERNANCA.map((m) => m.para),
]

export function estaEmConfiguracoes(caminho: string): boolean {
  return ROTAS_CONFIGURACOES.some(
    (r) => caminho === r || caminho.startsWith(`${r}/`),
  )
}
