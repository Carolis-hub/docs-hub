// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { IndexedItem, SearchItem } from '../types/search'
import { criarMotor } from './searchEngine'
import {
  INDEX_LIMITE_BYTES,
  caberNoLimite,
  itemDoArtigo,
  juntarColecoes,
  separarPorColecao,
  tamanhoBytes,
} from './searchIndex'

const PALAVRAS =
  'configurar envio email relatorio cadastro usuario permissao fluxo aprovacao documento anexo pasta processo regra campo tela botao menu sistema produto cliente contrato pagamento nota fiscal integracao servidor banco dados backup restaurar acesso perfil'.split(
    ' ',
  )

/** Gerador pseudoaleatório fixo, para o teste dar sempre os mesmos artigos. */
function sorteio(semente: number) {
  let s = semente
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296
}

function palavras(r: () => number, n: number): string {
  return Array.from(
    { length: n },
    () => PALAVRAS[Math.floor(r() * PALAVRAS.length)],
  ).join(' ')
}

function artigos(n: number, palavrasPorArtigo = 600): IndexedItem[] {
  const r = sorteio(n)
  return Array.from({ length: n }, (_, i) => ({
    ...itemDoArtigo({
      id: `a${i}`,
      titulo: `Artigo ${i} ${palavras(r, 4)}`,
      resumo: palavras(r, 25),
      textoPlano: palavras(r, palavrasPorArtigo),
      blockId: 'b',
      publico: 'usuario',
    }),
    productId: 'p',
  }))
}

describe('desempenho da busca no navegador', () => {
  // Folga grande de propósito: a CI é mais lenta que um computador comum. O
  // teste existe para pegar uma piora de ordem de grandeza, não de 20%.
  it('monta o motor de 1000 artigos longos e responde em milissegundos', () => {
    const itens = artigos(1000)
    const t0 = performance.now()
    const motor = criarMotor(itens, true)
    const montagem = performance.now() - t0

    const r = sorteio(7)
    const t1 = performance.now()
    for (let i = 0; i < 30; i++) motor.buscar(palavras(r, 2))
    const porBusca = (performance.now() - t1) / 30

    expect(motor.total).toBe(1000)
    expect(montagem).toBeLessThan(8000)
    expect(porBusca).toBeLessThan(250)
  })
})

describe('tamanho do índice de busca', () => {
  it('um artigo no limite de texto pesa cerca de 4 KB no índice, que é o que o navegador baixa', () => {
    const [item] = artigos(1)
    const kb = tamanhoBytes(item) / 1024
    expect(kb).toBeGreaterThan(3.5)
    expect(kb).toBeLessThan(5)
  })
})

describe('caberNoLimite', () => {
  const grande = (n: number): SearchItem[] =>
    artigos(n).map(({ productId: _p, ...i }) => i)

  it('não mexe no que já cabe', () => {
    const itens = grande(50)
    expect(caberNoLimite(itens)).toBe(itens)
  })

  it('encurta o texto de todos até caber, sem perder item, título nem resumo', () => {
    const itens = grande(260) // ~1,1 MB
    expect(tamanhoBytes({ itens })).toBeGreaterThan(INDEX_LIMITE_BYTES)
    const ajustado = caberNoLimite(itens)
    expect(tamanhoBytes({ itens: ajustado })).toBeLessThanOrEqual(
      INDEX_LIMITE_BYTES,
    )
    expect(ajustado).toHaveLength(itens.length)
    expect(ajustado.map((i) => i.titulo)).toEqual(itens.map((i) => i.titulo))
    expect(ajustado.map((i) => i.resumo)).toEqual(itens.map((i) => i.resumo))
    expect(ajustado[0]!.textoPlano.length).toBeLessThan(
      itens[0]!.textoPlano.length,
    )
    expect(ajustado[0]!.textoPlano).toBe(
      itens[0]!.textoPlano.slice(0, ajustado[0]!.textoPlano.length),
    )
  })

  it('perde o mínimo de texto: para no primeiro corte que couber', () => {
    const ajustado = caberNoLimite(grande(260))
    // 260 artigos de 4000 caracteres cabem com o texto cortado em 2000.
    expect(ajustado[0]!.textoPlano).toHaveLength(2000)
  })

  it('com muito mais artigos, tira o texto e mantém título e resumo', () => {
    const itens = grande(3000)
    const ajustado = caberNoLimite(itens, 400_000)
    expect(ajustado.every((i) => i.textoPlano === '')).toBe(true)
    expect(ajustado.every((i) => i.titulo !== '' && i.resumo !== '')).toBe(true)
  })

  it('a busca continua achando pelo título e pelo começo do texto depois do corte', () => {
    const itens = grande(260)
    itens[0]!.titulo = 'Procedimento especial xyzzy'
    const ajustado = caberNoLimite(itens).map((i) => ({ ...i, productId: 'p' }))
    const motor = criarMotor(ajustado, true)
    expect(motor.buscar('xyzzy')[0]?.item.id).toBe('a0')
  })
})

describe('índice separado por público', () => {
  const de = (id: string, publico: 'usuario' | 'tecnico') => ({
    id,
    titulo: id,
    resumo: '',
    textoPlano: id,
    blockId: 'b',
    publico,
  })

  it('cada artigo vai para a coleção do seu público', () => {
    const r = separarPorColecao([de('a', 'usuario'), de('t', 'tecnico')])
    expect(r.searchIndex.map((i) => i.id)).toEqual(['a'])
    expect(r.searchIndexTecnico.map((i) => i.id)).toEqual(['t'])
  })

  it('quem não leu a parte técnica não recebe técnico de índice antigo', () => {
    const antigos = [de('a', 'usuario'), de('t', 'tecnico')]
    expect(juntarColecoes(antigos, null).map((i) => i.id)).toEqual(['a'])
  })

  it('quem leu as duas não vê o mesmo artigo repetido', () => {
    const antigos = [de('a', 'usuario'), de('t', 'tecnico')]
    const juntos = juntarColecoes(antigos, [de('t', 'tecnico')])
    expect(juntos.map((i) => i.id)).toEqual(['a', 't'])
  })
})
