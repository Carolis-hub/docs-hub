import type { CategoriaId } from '../types/content'

/** Categorias da documentação funcional, na ordem em que aparecem nas telas. */
export const CATEGORIAS: { id: CategoriaId; nome: string }[] = [
  { id: 'funcionalidades', nome: 'Funcionalidades' },
  { id: 'configuracoes', nome: 'Configurações' },
  { id: 'processos', nome: 'Processos' },
  { id: 'regras-de-negocio', nome: 'Regras de negócio' },
]

/** Nome para exibir; devolve `undefined` quando não há categoria válida. */
export function nomeDaCategoria(id: string | undefined): string | undefined {
  return CATEGORIAS.find((c) => c.id === id)?.nome
}
