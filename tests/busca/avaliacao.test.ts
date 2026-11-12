import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  achou,
  lerCasosDeBusca,
  relatorioDaBusca,
  resumirBusca,
  rodarAvaliacaoDaBusca,
} from '../../scripts/busca/avaliacao'

const db = () =>
  getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-docs-hub' }))

const item = (
  id: string,
  titulo: string,
  texto: string,
  publico = 'usuario',
) => ({
  id,
  titulo,
  resumo: '',
  textoPlano: texto,
  blockId: 'p1',
  publico,
})

beforeEach(async () => {
  await fetch(
    'http://127.0.0.1:8080/emulator/v1/projects/demo-docs-hub/databases/(default)/documents',
    { method: 'DELETE' },
  )
  const d = db()
  await d.doc('blocks/p1').set({
    nome: 'SmartShare 4',
    parentId: null,
    productId: 'p1',
    sinonimos: ['excluir, apagar, remover'],
  })
  await d
    .doc('blocks/p2')
    .set({ nome: 'SmartShare DI', parentId: null, productId: 'p2' })
  await d.doc('searchIndex/p1').set({
    itens: [
      item('a1', 'Excluir documentos', 'Passos para excluir um documento.'),
      item('a2', 'Envio de e-mail', 'Configure o servidor de envio.'),
      item('a3', 'Relatório mensal', 'Como emitir o relatório do mês.'),
    ],
  })
  await d.doc('searchIndexTecnico/p1').set({
    itens: [item('t1', 'API de integração', 'Endpoints REST.', 'tecnico')],
  })
  await d.doc('searchIndex/p2').set({
    itens: [item('b1', 'Excluir documentos no DI', 'Outro produto.')],
  })
})

const casos = (lista: unknown[]) => {
  const lido = lerCasosDeBusca({ casos: lista })
  if ('erros' in lido) throw new Error(lido.erros.join('; '))
  return lido.casos
}

describe('avaliação da busca (Emulator)', () => {
  it('acha pelo título, pelo id, pelo plural e pelo sinônimo do produto', async () => {
    const r = await rodarAvaliacaoDaBusca(
      db(),
      casos([
        {
          id: 'titulo',
          consulta: 'envio de email',
          produto: 'p1',
          esperados: ['Envio de e-mail'],
        },
        {
          id: 'id',
          consulta: 'relatórios',
          produto: 'SmartShare 4',
          esperados: ['a3'],
        },
        {
          id: 'sinonimo',
          consulta: 'apagar documento',
          produto: 'smartshare 4',
          esperados: ['Excluir'],
        },
      ]),
      { verTecnico: true },
    )
    expect(r.map((x) => x.posicao)).toEqual([1, 1, 1])
    expect(resumirBusca(r)).toMatchObject({ total: 3, achados: 3, taxa: 1 })
  })

  it('a busca fica no produto do caso: não acha artigo de outro produto', async () => {
    const [r] = await rodarAvaliacaoDaBusca(
      db(),
      casos([
        { id: 'x', consulta: 'excluir', produto: 'p1', esperados: ['b1'] },
      ]),
      { verTecnico: true },
    )
    expect(r!.posicao).toBeNull()
    expect(r!.primeiros.map((p) => p.id)).toEqual(['a1'])
  })

  it('artigo técnico só aparece para quem vê técnico', async () => {
    const caso = casos([
      { id: 'api', consulta: 'api', produto: 'p1', esperados: ['t1'] },
    ])
    const [com] = await rodarAvaliacaoDaBusca(db(), caso, { verTecnico: true })
    const [sem] = await rodarAvaliacaoDaBusca(db(), caso, { verTecnico: false })
    expect(achou(com!)).toBe(true)
    expect(achou(sem!)).toBe(false)
  })

  it('produto desconhecido ou ambíguo vira erro do caso, sem derrubar os outros', async () => {
    const r = await rodarAvaliacaoDaBusca(
      db(),
      casos([
        { id: 'nao-existe', consulta: 'x', produto: 'Outro', esperados: ['a'] },
        {
          id: 'ambiguo',
          consulta: 'x',
          produto: 'SmartShare',
          esperados: ['a'],
        },
        { id: 'ok', consulta: 'envio', produto: 'p1', esperados: ['a2'] },
      ]),
      { verTecnico: true },
    )
    expect(r[0]!.erro).toMatch(/não encontrado/)
    expect(r[1]!.erro).toMatch(/mais de um produto/)
    expect(achou(r[2]!)).toBe(true)
    expect(resumirBusca(r)).toMatchObject({ achados: 1, comErro: 2 })
  })

  it('o relatório explica o que veio no lugar do artigo esperado', async () => {
    const r = await rodarAvaliacaoDaBusca(
      db(),
      casos([
        {
          id: 'sem-nada',
          consulta: 'boleto',
          produto: 'p1',
          esperados: ['Boleto'],
        },
        {
          id: 'errou',
          consulta: 'excluir',
          produto: 'p1',
          esperados: ['Relatório'],
        },
      ]),
      { verTecnico: true },
    )
    const md = relatorioDaBusca(r)
    expect(md).toContain('entre os 5 primeiros: 0 (0%)')
    expect(md).toContain('Buscas sem nenhum resultado: 1')
    expect(md).toContain('A busca não trouxe nada')
    expect(md).toContain('1. Excluir documentos')
  })
})

describe('arquivo de casos da busca', () => {
  it('recusa caso sem artigo esperado e ids repetidos', () => {
    expect(
      lerCasosDeBusca({
        casos: [{ id: 'a', consulta: 'x', produto: 'p', esperados: [] }],
      }),
    ).toHaveProperty('erros')
    const caso = { id: 'a', consulta: 'x', produto: 'p', esperados: ['y'] }
    expect(lerCasosDeBusca({ casos: [caso, caso] })).toEqual({
      erros: ['ids repetidos: a'],
    })
  })

  it('o exemplo do repositório é válido', async () => {
    const { readFile } = await import('node:fs/promises')
    const exemplo = JSON.parse(
      await readFile('docs/avaliacao-busca.exemplo.json', 'utf8'),
    )
    expect(lerCasosDeBusca(exemplo)).toHaveProperty('casos')
  })
})
