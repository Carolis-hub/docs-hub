/** Como cada ação da trilha de auditoria aparece para o admin. */
const ROTULOS: Record<string, string> = {
  'bloco.criar': 'Criou um bloco',
  'bloco.editar': 'Editou um bloco',
  'bloco.excluir': 'Excluiu um bloco',
  'unidade.criar': 'Criou uma unidade de negócio',
  'unidade.editar': 'Editou uma unidade de negócio',
  'unidade.excluir': 'Excluiu uma unidade de negócio',
  'artigo.criar': 'Criou o artigo',
  'artigo.editar': 'Editou o artigo',
  'artigo.enviar-revisao': 'Enviou para revisão',
  'artigo.aprovar': 'Aprovou',
  'artigo.reprovar': 'Reprovou (pediu ajustes)',
  'artigo.devolver-rascunho': 'Voltou a rascunho',
  'artigo.publicar': 'Publicou',
  'artigo.despublicar': 'Despublicou',
  'artigo.arquivar': 'Arquivou',
  'artigo.restaurar': 'Restaurou como rascunho',
  'artigo.excluir': 'Excluiu o artigo',
  'artigo.prints': 'Atualizou o alerta de prints',
  'artigo.origem-removida': 'Tratou o aviso de arquivo removido',
  'revisao.salvar': 'Salvou uma alteração pendente',
  'revisao.descartar': 'Descartou a alteração pendente',
  'comentario.criar': 'Comentou',
  'sugestao.criar': 'Recebeu uma sugestão',
  'sugestao.aprovar': 'Aprovou uma sugestão',
  'sugestao.descartar': 'Descartou uma sugestão',
  'usuario.criar': 'Criou um usuário',
  'usuario.editar': 'Editou um usuário',
  'usuario.desativar': 'Desativou um usuário',
  'usuario.reativar': 'Reativou um usuário',
  'migracao.importar': 'Importou documentos (migração)',
  'ingestao.sincronizar': 'Sincronizou uma pasta de documentos',
}

export function rotuloDaAuditoria(acao: string): string {
  return ROTULOS[acao] ?? acao
}

/** Grupos para o filtro da tela de auditoria (pelo prefixo da ação). */
export const GRUPOS_AUDITORIA = [
  { id: 'artigo', nome: 'Artigos' },
  { id: 'revisao', nome: 'Alterações pendentes' },
  { id: 'comentario', nome: 'Comentários' },
  { id: 'sugestao', nome: 'Sugestões' },
  { id: 'bloco', nome: 'Blocos' },
  { id: 'unidade', nome: 'Unidades' },
  { id: 'usuario', nome: 'Usuários' },
  { id: 'migracao', nome: 'Importações' },
  { id: 'ingestao', nome: 'Ingestão de arquivos' },
] as const

export const grupoDaAcao = (acao: string) => acao.split('.')[0] ?? acao

/** Id do artigo quando o alvo é `articles/<id>` ou algo dentro dele. */
export function artigoDoAlvo(alvo: string): string | null {
  const m = /^articles\/([^/]+)/.exec(alvo)
  return m?.[1] ?? null
}
