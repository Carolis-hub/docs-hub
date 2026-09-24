export interface Block {
  id: string
  nome: string
  slug: string
  descricao: string
  icone: string
  ordem: number
  parentId: string | null
  productId: string
}

export type BlockInput = Pick<
  Block,
  'nome' | 'descricao' | 'icone' | 'parentId'
>
