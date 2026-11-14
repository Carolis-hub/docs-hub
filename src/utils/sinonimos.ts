import { normalizar } from './search.ts'

export const MAX_GRUPOS_SINONIMOS = 200
const MAX_TERMOS = 12
const MAX_TERMO = 40

/**
 * Sinônimos da busca de um produto. Cada linha é um grupo de termos que, na
 * documentação daquele produto, querem dizer a mesma coisa, separados por
 * vírgula: `excluir, apagar, remover`. Ficam no documento do produto
 * (`blocks/{id}.sinonimos`), que a busca já lê, então não custam leitura a mais.
 */
export function limparSinonimos(linhas: readonly string[]): string[] {
  const saida: string[] = []
  for (const linha of linhas) {
    const termos = [
      ...new Set(
        linha
          .split(/[,;]/)
          .map((t) => t.replace(/\s+/g, ' ').trim().slice(0, MAX_TERMO))
          .filter(Boolean),
      ),
    ].slice(0, MAX_TERMOS)
    // Um termo sozinho não é sinônimo de nada.
    if (termos.length >= 2) saida.push(termos.join(', '))
    if (saida.length >= MAX_GRUPOS_SINONIMOS) break
  }
  return saida
}

/**
 * Sugestão padrão: grupos genéricos, que valem para qualquer sistema (verbos
 * e termos comuns de tela). Um produto que nunca teve os sinônimos salvos
 * começa com eles; depois de salvar, vale só a lista do produto (inclusive
 * vazia). Termos próprios de um produto ficam no cadastro dele, não aqui.
 */
export const SINONIMOS_PADRAO: readonly string[] = [
  'excluir, apagar, remover, deletar, eliminar',
  'alterar, trocar, mudar, modificar, editar',
  'encontrar, pesquisar, procurar, localizar, buscar, achar',
  'adicionar, incluir, inserir, anexar, colocar',
  'visualizar, ver, exibir, consultar, abrir',
  'baixar, download, exportar, salvar',
  'compartilhar, enviar, encaminhar',
  'cancelar, interromper, abortar, parar',
  'revisar, conferir, validar, checar',
  'configurar, parametrizar, ajustar, definir',
  'instalar, instalação, implantar, setup',
  'login, entrar, logar, autenticar, acessar',
  'sair, logout, deslogar, desconectar',
  'esqueci minha senha, recuperar senha, redefinir senha, resetar senha, nova senha',
  'duplo fator, dois fatores, 2fa, mfa, verificação em duas etapas',
  'alerta, aviso, notificação, lembrete',
  'comentário, observação, anotação, nota',
  'template, modelo',
  'lote, massa, vários, múltiplos',
  'prioridade, urgência, urgente',
  'idioma, língua, linguagem, tradução',
  'permissão, autorização, direito, acesso',
  'requisito, pré-requisito, exigência, necessário',
  'finalizado, concluído, encerrado, terminado',
]

/**
 * As linhas que valem para um produto: as dele, se já foram salvas alguma
 * vez; senão, a sugestão padrão.
 */
export function sinonimosDoProduto(
  salvos: readonly string[] | undefined,
): readonly string[] {
  return salvos ?? SINONIMOS_PADRAO
}

/** Grupos prontos para a busca: minúsculas, sem acento. */
export function gruposDeSinonimos(
  linhas: readonly string[] | undefined,
): string[][] {
  return limparSinonimos(linhas ?? []).map((linha) =>
    linha.split(', ').map(normalizar),
  )
}
