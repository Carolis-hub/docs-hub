import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import type { PedidoAlt, ProvedorAlt } from '../../scripts/alt-texto/ia'
import { imagensAlvo, sugerirAltTextos } from '../../scripts/alt-texto/sugerir'
import { imagensComContexto } from '../../src/utils/altTexto'

const db = () =>
  getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-docs-hub' }))
const limpar = () =>
  fetch(
    'http://127.0.0.1:8080/emulator/v1/projects/demo-docs-hub/databases/(default)/documents',
    {
      method: 'DELETE',
    },
  )

const p = (t: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text: t }],
})
const img = (src: string, alt: string) => ({
  type: 'image',
  attrs: { src, alt },
})

function artigo(titulo: string, conteudo: unknown[], status = 'published') {
  return {
    titulo,
    status,
    versao: 2,
    atualizadoEm: 111,
    productId: 'p1',
    blockId: 'p1',
    conteudo: { type: 'doc', content: conteudo },
  }
}

/** IA falsa: devolve um alt por imagem e guarda os pedidos. */
function provedor(
  opcoes: {
    falharComImagem?: (src: string) => boolean
    confianca?: 'alta' | 'media' | 'baixa'
    decorativa?: boolean
  } = {},
  pedidos: PedidoAlt[] = [],
): ProvedorAlt {
  return {
    modelo: 'modelo-falso',
    async sugerir(pedido) {
      pedidos.push(pedido)
      if (
        pedido.comImagem &&
        pedido.imagens.some((i) => opcoes.falharComImagem?.(i.src))
      ) {
        throw new Error('imagem inacessível')
      }
      return {
        textos: pedido.imagens.map((i) => ({
          indice: i.indice,
          alt: `Imagem de tela com descrição da imagem ${i.indice + 1}`,
          confianca: opcoes.confianca ?? 'alta',
          decorativa: opcoes.decorativa ?? false,
        })),
      }
    },
  }
}

const base = { gravar: true, agora: 1_700_000_000_000 }

beforeAll(async () => {
  await limpar()
  const d = db()
  await d
    .collection('articles')
    .doc('a1')
    .set(
      artigo('Anexos', [
        p('Texto de abertura.'),
        img('https://cdn/a.gif', 'Imagem 1 do artigo "Anexos"'),
        img('https://cdn/b.png', 'Tela de erro no upload'),
        img('https://cdn/c.png', ''),
      ]),
    )
  await d
    .collection('articles')
    .doc('a2')
    .set(
      artigo('Só alts bons', [
        img('https://cdn/d.png', 'Lista de tarefas pendentes'),
      ]),
    )
  await d
    .collection('articles')
    .doc('a3')
    .set(artigo('Sem imagens', [p('só texto')]))
  await d
    .collection('articles')
    .doc('a4')
    .set(artigo('Rascunho', [img('https://cdn/e.png', '')], 'draft'))
})

afterAll(limpar)

describe('imagensAlvo', () => {
  const doc = artigo('x', [
    img('u1', ''),
    img('u2', 'Bom alt'),
    img('', ''),
    img('u4', 'Imagem 2 do artigo "x"'),
  ]).conteudo
  it('pega só as imagens com alt fraco e com endereço', () => {
    expect(imagensAlvo(doc, false).map((i) => i.src)).toEqual(['u1', 'u4'])
  })
  it('com revisarTodas pega todas as que têm endereço', () => {
    expect(imagensAlvo(doc, true).map((i) => i.src)).toEqual(['u1', 'u2', 'u4'])
  })
})

describe('sugerirAltTextos (Emulator)', () => {
  it('cria uma sugestão pendente só com os alts fracos trocados', async () => {
    const pedidos: PedidoAlt[] = []
    const [r] = await sugerirAltTextos(db(), provedor({}, pedidos), {
      ...base,
      artigos: ['a1'],
    })
    expect(r).toMatchObject({ artigoId: 'a1', status: 'criada', imagens: 2 })
    expect(pedidos).toHaveLength(1)
    expect(pedidos[0]?.imagens.map((i) => i.indice)).toEqual([0, 2]) // a imagem 1 já tem alt bom
    expect(pedidos[0]?.comImagem).toBe(true)

    const sugs = await db().collection('articles/a1/suggestions').get()
    expect(sugs.size).toBe(1)
    const s = sugs.docs[0]!.data()
    expect(s).toMatchObject({
      status: 'pending',
      titulo: 'Anexos',
      origem: { tipo: 'alt-texto' },
      baseVersao: 2,
      baseAtualizadoEm: 111,
      modelo: 'modelo-falso',
    })
    const alts = imagensComContexto(s.conteudo).map((i) => i.alt)
    expect(alts).toEqual([
      'Tela com descrição da imagem 1', // "Imagem de" removido
      'Tela de erro no upload', // intacto
      'Tela com descrição da imagem 3',
    ])
    expect(s.diffResumo).toHaveLength(2)
    expect(s.diffResumo[0]).toBe(
      'Imagem 1: “Imagem 1 do artigo "Anexos"” → “Tela com descrição da imagem 1”',
    )
    expect(s.textoPlano).toContain('Tela com descrição da imagem 1')
  })

  it('o artigo original não muda', async () => {
    const a = (await db().collection('articles').doc('a1').get()).data()
    expect(imagensComContexto(a?.conteudo)[0]?.alt).toBe(
      'Imagem 1 do artigo "Anexos"',
    )
    expect(a?.versao).toBe(2)
  })

  it('é idempotente e não chama a IA de novo', async () => {
    const pedidos: PedidoAlt[] = []
    const [r] = await sugerirAltTextos(db(), provedor({}, pedidos), {
      ...base,
      artigos: ['a1'],
    })
    expect(r?.status).toBe('ja-existia')
    expect(pedidos).toHaveLength(0)
    expect((await db().collection('articles/a1/suggestions').get()).size).toBe(
      1,
    )
  })

  it('não faz nada em artigo sem alts fracos, sem imagens, ou que não existe', async () => {
    const r = await sugerirAltTextos(db(), provedor(), {
      ...base,
      artigos: ['a2', 'a3', 'nao-existe'],
    })
    expect(r.map((x) => x.status)).toEqual([
      'nada-a-fazer',
      'nada-a-fazer',
      'artigo-nao-encontrado',
    ])
  })

  it('--todos varre só os artigos publicados e respeita o limite', async () => {
    const pedidos: PedidoAlt[] = []
    const r = await sugerirAltTextos(db(), provedor({}, pedidos), {
      ...base,
      todos: true,
      gravar: false,
    })
    // a4 é rascunho e fica de fora; a1 já tem sugestão
    expect(r.map((x) => [x.artigoId, x.status]).sort()).toEqual([
      ['a1', 'ja-existia'],
      ['a2', 'nada-a-fazer'],
      ['a3', 'nada-a-fazer'],
    ])
    expect(pedidos).toHaveLength(0)
  })

  it('revisarTodas inclui os alts bons', async () => {
    const pedidos: PedidoAlt[] = []
    const [r] = await sugerirAltTextos(db(), provedor({}, pedidos), {
      ...base,
      artigos: ['a2'],
      revisarTodas: true,
      gravar: false,
    })
    expect(r).toMatchObject({ status: 'simulada', imagens: 1 })
    expect(r?.mudancas?.[0]).toContain('“Lista de tarefas pendentes” →')
  })

  it('em simulação a IA roda mas nada é gravado', async () => {
    await db()
      .collection('articles')
      .doc('a5')
      .set(artigo('Novo', [img('https://cdn/n.png', '')]))
    const [r] = await sugerirAltTextos(db(), provedor(), {
      ...base,
      artigos: ['a5'],
      gravar: false,
    })
    expect(r?.status).toBe('simulada')
    expect((await db().collection('articles/a5/suggestions').get()).size).toBe(
      0,
    )
  })

  it('se uma imagem não abre, tenta uma a uma e depois só pelo texto, com aviso', async () => {
    await db()
      .collection('articles')
      .doc('a6')
      .set(
        artigo('Com imagem quebrada', [
          p('contexto'),
          img('https://cdn/ok.png', ''),
          img('https://cdn/quebrada.png', ''),
        ]),
      )
    const pedidos: PedidoAlt[] = []
    const [r] = await sugerirAltTextos(
      db(),
      provedor({ falharComImagem: (s) => s.includes('quebrada') }, pedidos),
      { ...base, artigos: ['a6'] },
    )
    expect(r?.status).toBe('criada')
    // lote (falha) → ok.png sozinha (ok) → quebrada.png com imagem (falha) → quebrada.png só texto
    expect(pedidos.map((x) => [x.imagens.length, x.comImagem])).toEqual([
      [2, true],
      [1, true],
      [1, true],
      [1, false],
    ])
    const s = (
      await db().collection('articles/a6/suggestions').get()
    ).docs[0]!.data()
    expect(s.avisos).toEqual([
      expect.stringContaining('não conseguiu ver a imagem'),
    ])
    expect(s.avisos[0]).toContain('Imagem 2')
  })

  it('avisa quando a confiança é baixa ou a imagem parece decorativa', async () => {
    await db()
      .collection('articles')
      .doc('a7')
      .set(artigo('Duvidoso', [img('https://cdn/z.png', '')]))
    const [r] = await sugerirAltTextos(
      db(),
      provedor({ confianca: 'baixa', decorativa: true }),
      {
        ...base,
        artigos: ['a7'],
      },
    )
    expect(r?.status).toBe('criada')
    const s = (
      await db().collection('articles/a7/suggestions').get()
    ).docs[0]!.data()
    expect(s.avisos.join('|')).toMatch(/confiança baixa/)
    expect(s.avisos.join('|')).toMatch(/decorativa/)
  })

  it('respeita o limite de artigos', async () => {
    await db()
      .collection('articles')
      .doc('b1')
      .set(artigo('B1', [img('https://cdn/b1.png', '')]))
    await db()
      .collection('articles')
      .doc('b2')
      .set(artigo('B2', [img('https://cdn/b2.png', '')]))
    const r = await sugerirAltTextos(db(), provedor(), {
      ...base,
      artigos: ['b1', 'b2'],
      limiteArtigos: 1,
      gravar: false,
    })
    expect(r.map((x) => x.artigoId)).toEqual(['b1'])
  })

  it('a IA que esquece uma imagem não derruba as outras', async () => {
    await db()
      .collection('articles')
      .doc('c1')
      .set(
        artigo('C', [
          img('https://cdn/c1.png', ''),
          img('https://cdn/c2.png', ''),
        ]),
      )
    const esquecido: ProvedorAlt = {
      modelo: 'm',
      sugerir: async (pedido) => ({
        textos: pedido.imagens.slice(0, 1).map((i) => ({
          indice: i.indice,
          alt: 'Botão salvar',
          confianca: 'alta' as const,
          decorativa: false,
        })),
      }),
    }
    const [r] = await sugerirAltTextos(db(), esquecido, {
      ...base,
      artigos: ['c1'],
    })
    expect(r?.status).toBe('criada')
    const s = (
      await db().collection('articles/c1/suggestions').get()
    ).docs[0]!.data()
    expect(s.diffResumo).toHaveLength(1)
    expect(s.avisos).toEqual([
      expect.stringContaining('a IA não devolveu um texto'),
    ])
  })
})
