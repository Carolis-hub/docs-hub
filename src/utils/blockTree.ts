import type { Block } from '../types/block'

export interface BlockOption {
  id: string
  caminho: string
}

/** Monta o caminho completo (ex.: "Smartshare > BPM") para cada bloco, ordenado pela hierarquia. */
export function montarOpcoesDeBloco(blocos: Block[]): BlockOption[] {
  const porId = new Map(blocos.map((bloco) => [bloco.id, bloco]))

  function caminhoDe(bloco: Block): string {
    if (!bloco.parentId) return bloco.nome
    const pai = porId.get(bloco.parentId)
    return pai ? `${caminhoDe(pai)} > ${bloco.nome}` : bloco.nome
  }

  return blocos
    .map((bloco) => ({ id: bloco.id, caminho: caminhoDe(bloco) }))
    .sort((a, b) => a.caminho.localeCompare(b.caminho, 'pt-BR'))
}
