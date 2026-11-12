import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/*
 * Matriz de permissões: cada coleção do banco contra cada tipo de pessoa.
 * Cada linha diz QUEM pode; todo o resto precisa ser negado. Quem acrescentar
 * uma coleção às regras sem entrar aqui faz o último teste falhar.
 */

type Pessoa =
  | 'anonimo'
  | 'semPerfil'
  | 'inativo'
  | 'leitor'
  | 'tecnico'
  | 'leitorP2'
  | 'admin'

const PESSOAS: Pessoa[] = [
  'anonimo',
  'semPerfil',
  'inativo',
  'leitor',
  'tecnico',
  'leitorP2',
  'admin',
]

/** Quem tem perfil ativo (qualquer papel). */
const ATIVOS: Pessoa[] = ['leitor', 'tecnico', 'leitorP2', 'admin']
const SO_ADMIN: Pessoa[] = ['admin']
const NINGUEM: Pessoa[] = []

let env: RulesTestEnvironment

const banco = (p: Pessoa) => {
  switch (p) {
    case 'anonimo':
      return env.unauthenticatedContext().firestore()
    case 'semPerfil':
      return env.authenticatedContext('sem-perfil').firestore()
    default:
      return env.authenticatedContext(p).firestore()
  }
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-docs-hub-matriz',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'users/admin'), { role: 'admin', nome: 'Admin' })
    await setDoc(doc(d, 'users/leitor'), {
      role: 'reader',
      produtosPermitidos: ['p1'],
    })
    await setDoc(doc(d, 'users/tecnico'), {
      role: 'reader',
      produtosPermitidos: ['p1'],
      verTecnico: true,
    })
    await setDoc(doc(d, 'users/leitorP2'), {
      role: 'reader',
      produtosPermitidos: ['p2'],
    })
    await setDoc(doc(d, 'users/inativo'), {
      role: 'reader',
      produtosPermitidos: ['p1'],
      ativo: false,
    })
    await setDoc(doc(d, 'unidades/u1'), { nome: 'U' })
    await setDoc(doc(d, 'blocks/p1'), { productId: 'p1', parentId: null })
    await setDoc(doc(d, 'blocks/p2'), { productId: 'p2', parentId: null })
    const artigo = (productId: string, status: string, publico: string) => ({
      productId,
      status,
      publico,
      views: 0,
    })
    await setDoc(doc(d, 'articles/pub'), artigo('p1', 'published', 'usuario'))
    await setDoc(doc(d, 'articles/tec'), artigo('p1', 'published', 'tecnico'))
    for (const status of [
      'draft',
      'review',
      'approved',
      'rejected',
      'archived',
    ]) {
      await setDoc(
        doc(d, `articles/${status}`),
        artigo('p1', status, 'usuario'),
      )
    }
    await setDoc(doc(d, 'articles/outro'), artigo('p2', 'published', 'usuario'))
    for (const sub of [
      'versions/1',
      'revisoes/atual',
      'comentarios/c1',
      'suggestions/s1',
      'viewsDaily/2026-01-01',
    ]) {
      await setDoc(doc(d, `articles/pub/${sub}`), { x: 1 })
    }
    await setDoc(doc(d, 'searchIndex/p1'), { itens: [] })
    await setDoc(doc(d, 'searchIndex/p1/partes/bpm'), { itens: [] })
    await setDoc(doc(d, 'searchIndex/p2'), { itens: [] })
    await setDoc(doc(d, 'searchIndexTecnico/p1'), { itens: [] })
    await setDoc(doc(d, 'searchIndexTecnico/p1/partes/bpm'), { itens: [] })
    await setDoc(doc(d, 'searchIndexTecnico/p2'), { itens: [] })
    await setDoc(doc(d, 'searchMisses/termo'), { termo: 'x', count: 1 })
    await setDoc(doc(d, 'searchFeedback/p1__x'), {
      termo: 'x',
      productId: 'p1',
      sim: 1,
      nao: 0,
    })
    await setDoc(doc(d, 'assistenteUso/g_2026-01-01'), { perguntas: 1 })
    await setDoc(doc(d, 'assistenteLog/log'), { uid: 'leitor', feedback: null })
    await setDoc(doc(d, 'auditLog/a1'), { usuarioId: 'admin', acao: 'x' })
    await setDoc(doc(d, 'fontes/f1'), { fonteId: 'f' })
    await setDoc(doc(d, 'sincronizacoes/s1'), { fonteId: 's' })
    const prefs = { aside: { visivel: true, manual: true, busca: true } }
    await setDoc(doc(d, 'preferenciasUsuario/leitor'), prefs)
    await setDoc(doc(d, 'preferenciasUsuario/admin'), prefs)
    await setDoc(doc(d, 'colecaoDesconhecida/x'), { x: 1 })
  })
})

afterAll(() => env.cleanup())

async function conferir(
  titulo: string,
  podem: Pessoa[],
  executar: (p: Pessoa) => Promise<unknown>,
) {
  for (const p of PESSOAS) {
    const resultado = podem.includes(p) ? assertSucceeds : assertFails
    await resultado(executar(p)).catch((e: unknown) => {
      throw new Error(
        `${titulo}: ${p} ${podem.includes(p) ? 'deveria poder' : 'não deveria poder'}. ${e instanceof Error ? e.message : e}`,
      )
    })
  }
}

describe('matriz de permissões: leitura', () => {
  const LEITURAS: Array<[string, Pessoa[]]> = [
    // Perfis: cada um lê o próprio; só admin lê os dos outros.
    ['users/leitor', ['leitor', 'admin']],
    ['users/tecnico', ['tecnico', 'admin']],
    ['users/inativo', ['admin']], // conta desativada perde até o próprio perfil
    ['users/admin', SO_ADMIN],
    // Qualquer pessoa com perfil ativo lê os nomes das unidades.
    ['unidades/u1', ATIVOS],
    // Conteúdo: só do produto permitido; o técnico só com a permissão.
    ['blocks/p1', ['leitor', 'tecnico', 'admin']],
    ['blocks/p2', ['leitorP2', 'admin']],
    ['articles/pub', ['leitor', 'tecnico', 'admin']],
    ['articles/tec', ['tecnico', 'admin']],
    ['articles/draft', SO_ADMIN],
    ['articles/review', SO_ADMIN],
    ['articles/approved', SO_ADMIN],
    ['articles/rejected', SO_ADMIN],
    ['articles/archived', SO_ADMIN],
    ['articles/outro', ['leitorP2', 'admin']],
    // Subcoleções do artigo: bastidores da edição, só admin.
    ['articles/pub/versions/1', SO_ADMIN],
    ['articles/pub/revisoes/atual', SO_ADMIN],
    ['articles/pub/comentarios/c1', SO_ADMIN],
    ['articles/pub/suggestions/s1', SO_ADMIN],
    ['articles/pub/viewsDaily/2026-01-01', SO_ADMIN],
    // Índice de busca: por produto.
    ['searchIndex/p1', ['leitor', 'tecnico', 'admin']],
    ['searchIndex/p1/partes/bpm', ['leitor', 'tecnico', 'admin']],
    ['searchIndex/p2', ['leitorP2', 'admin']],
    // Parte técnica do índice: produto permitido e `verTecnico`.
    ['searchIndexTecnico/p1', ['tecnico', 'admin']],
    ['searchIndexTecnico/p1/partes/bpm', ['tecnico', 'admin']],
    ['searchIndexTecnico/p2', ['admin']],
    // Painéis e registros: só admin.
    ['searchMisses/termo', SO_ADMIN],
    ['searchFeedback/p1__x', SO_ADMIN],
    ['assistenteUso/g_2026-01-01', SO_ADMIN],
    ['assistenteLog/log', SO_ADMIN],
    ['auditLog/a1', SO_ADMIN],
    ['fontes/f1', SO_ADMIN],
    ['sincronizacoes/s1', SO_ADMIN],
    // Configurações pessoais: só o dono lê as suas (nem o admin lê as dos outros).
    ['preferenciasUsuario/leitor', ['leitor']],
    ['preferenciasUsuario/admin', ['admin']],
    // O que não está nas regras é negado a todos, até ao admin.
    ['colecaoDesconhecida/x', NINGUEM],
  ]

  it.each(LEITURAS)('ler %s', async (caminho, podem) => {
    await conferir(`ler ${caminho}`, podem, (p) =>
      getDoc(doc(banco(p), caminho)),
    )
  })
})

describe('matriz de permissões: escrita', () => {
  /** Escrever num documento novo (id próprio por pessoa, para uma não atrapalhar a outra). */
  const ESCRITAS: Array<[string, Pessoa[], Record<string, unknown>]> = [
    ['users', SO_ADMIN, { role: 'reader', nome: 'N' }],
    ['unidades', SO_ADMIN, { nome: 'N' }],
    ['blocks', SO_ADMIN, { productId: 'p1', parentId: null }],
    ['articles', SO_ADMIN, { productId: 'p1', status: 'draft' }],
    ['articles/pub/versions', SO_ADMIN, { versao: 9 }],
    ['articles/pub/revisoes', SO_ADMIN, { titulo: 'x' }],
    ['articles/pub/comentarios', SO_ADMIN, { texto: 'x' }],
    ['articles/pub/suggestions', SO_ADMIN, { status: 'pending' }],
    ['searchIndex', SO_ADMIN, { itens: [] }],
    ['searchIndex/p1/partes', SO_ADMIN, { itens: [] }],
    ['searchIndexTecnico', SO_ADMIN, { itens: [] }],
    ['searchIndexTecnico/p1/partes', SO_ADMIN, { itens: [] }],
    ['fontes', SO_ADMIN, { fonteId: 'x' }],
    // Só o servidor (Admin SDK, que ignora as regras) escreve nestas.
    ['sincronizacoes', NINGUEM, { fonteId: 'x' }],
    ['assistenteUso', NINGUEM, { perguntas: 1 }],
    ['assistenteLog', NINGUEM, { uid: 'leitor' }],
    // Só o dono grava, no documento com o próprio uid (ver o teste abaixo).
    [
      'preferenciasUsuario',
      NINGUEM,
      { aside: { visivel: true, manual: true, busca: true } },
    ],
    ['colecaoDesconhecida', NINGUEM, { x: 1 }],
  ]

  it.each(ESCRITAS)('criar em %s', async (colecao, podem, dados) => {
    await conferir(`criar em ${colecao}`, podem, (p) =>
      setDoc(
        doc(
          banco(p),
          `${colecao}/novo-${p}-${Math.random().toString(36).slice(2)}`,
        ),
        dados,
      ),
    )
  })

  it('editar e apagar o que já existe: só admin, e só onde as regras deixam', async () => {
    await conferir('editar blocks/p1', SO_ADMIN, (p) =>
      updateDoc(doc(banco(p), 'blocks/p1'), { nome: `por ${p}` }),
    )
    await conferir('editar users/leitor', SO_ADMIN, (p) =>
      updateDoc(doc(banco(p), 'users/leitor'), { nome: `por ${p}` }),
    )
    await conferir('apagar articles/archived', SO_ADMIN, async (p) => {
      const alvo = doc(banco(p), `articles/apagar-${p}`)
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `articles/apagar-${p}`), {
          productId: 'p1',
          status: 'archived',
        })
      })
      return deleteDoc(alvo)
    })
  })

  it('configurações pessoais: só o dono grava, no formato certo, e ninguém apaga', async () => {
    const validas = { aside: { visivel: false, manual: true, busca: false } }
    for (const p of PESSOAS) {
      const meu = doc(banco(p), `preferenciasUsuario/${p}`)
      const pode = ATIVOS.includes(p)
      await (pode ? assertSucceeds : assertFails)(setDoc(meu, validas))
      if (pode) {
        // Não grava no documento de outra pessoa.
        await assertFails(
          setDoc(doc(banco(p), 'preferenciasUsuario/outra-pessoa'), validas),
        )
        // Formato inválido: campo a mais, valor que não é verdadeiro/falso, mapa faltando.
        await assertFails(setDoc(meu, { ...validas, extra: 1 }))
        await assertFails(
          setDoc(meu, { aside: { visivel: 'sim', manual: true, busca: true } }),
        )
        await assertFails(
          setDoc(meu, { aside: { visivel: true, manual: true } }),
        )
        await assertFails(setDoc(meu, { aside: 'tudo' }))
        // Com o carimbo de data, aceita.
        await assertSucceeds(setDoc(meu, { ...validas, atualizadoEm: 123 }))
        await assertFails(deleteDoc(meu))
      }
    }
  })

  it('auditoria: admin cria com o próprio id; ninguém edita nem apaga', async () => {
    const admin = banco('admin')
    await assertSucceeds(
      setDoc(doc(admin, 'auditLog/novo1'), { usuarioId: 'admin', acao: 'x' }),
    )
    await assertFails(
      setDoc(doc(admin, 'auditLog/novo2'), { usuarioId: 'outro', acao: 'x' }),
    )
    for (const p of PESSOAS) {
      // Só o admin passa, e só com `usuarioId` igual ao próprio uid.
      const criar = setDoc(doc(banco(p), `auditLog/de-${p}`), {
        usuarioId: p,
        acao: 'x',
      })
      await (p === 'admin' ? assertSucceeds(criar) : assertFails(criar))
      await assertFails(updateDoc(doc(banco(p), 'auditLog/a1'), { acao: 'y' }))
      await assertFails(deleteDoc(doc(banco(p), 'auditLog/a1')))
    }
  })
})

describe('matriz de permissões: o que o leitor pode escrever', () => {
  it('somar 1 às visualizações do artigo que ele pode ler, e só isso', async () => {
    const somar = (p: Pessoa, id: string, views: number) =>
      updateDoc(doc(banco(p), `articles/${id}`), { views })
    await assertSucceeds(somar('leitor', 'pub', 1))
    await assertSucceeds(somar('tecnico', 'tec', 1))
    await assertFails(somar('leitor', 'pub', 99)) // não soma só 1
    await assertFails(somar('leitor', 'tec', 1)) // técnico sem permissão
    await assertFails(somar('leitor', 'draft', 1)) // não publicado
    await assertFails(somar('leitor', 'outro', 1)) // outro produto
    await assertFails(somar('leitorP2', 'pub', 1))
    await assertFails(somar('inativo', 'pub', 1))
    await assertFails(somar('semPerfil', 'pub', 1))
    await assertFails(somar('anonimo', 'pub', 1))
    await assertFails(
      updateDoc(doc(banco('leitor'), 'articles/pub'), {
        views: 2,
        titulo: 'x',
      }),
    )
  })

  it('contador diário de visualização: cria com 1 ou soma 1, sem poder ler', async () => {
    await assertSucceeds(
      setDoc(doc(banco('leitor'), 'articles/pub/viewsDaily/2026-02-01'), {
        count: 1,
        dia: '2026-02-01',
      }),
    )
    await assertFails(
      setDoc(doc(banco('leitor'), 'articles/pub/viewsDaily/2026-02-02'), {
        count: 50,
        dia: '2026-02-02',
      }),
    )
    await assertFails(
      setDoc(doc(banco('leitorP2'), 'articles/pub/viewsDaily/2026-02-03'), {
        count: 1,
        dia: '2026-02-03',
      }),
    )
    await assertFails(
      getDoc(doc(banco('leitor'), 'articles/pub/viewsDaily/2026-02-01')),
    )
  })

  it('busca sem resultado: contador por termo, só criar com 1 ou somar 1; só admin lê', async () => {
    await assertSucceeds(
      setDoc(doc(banco('leitor'), 'searchMisses/novo-termo'), {
        termo: 'novo termo',
        count: 1,
        ultimaVez: 1,
      }),
    )
    await assertFails(
      setDoc(doc(banco('leitor'), 'searchMisses/outro-termo'), {
        termo: 'outro',
        count: 7,
        ultimaVez: 1,
      }),
    )
    await assertFails(
      setDoc(doc(banco('anonimo'), 'searchMisses/anon'), {
        termo: 'x',
        count: 1,
        ultimaVez: 1,
      }),
    )
    await assertFails(getDoc(doc(banco('leitor'), 'searchMisses/novo-termo')))
  })

  it('avaliar a própria resposta do assistente: só o campo feedback, só do dono', async () => {
    await assertSucceeds(
      updateDoc(doc(banco('leitor'), 'assistenteLog/log'), {
        feedback: 'util',
      }),
    )
    await assertFails(
      updateDoc(doc(banco('leitor'), 'assistenteLog/log'), {
        feedback: 'lixo',
      }),
    )
    await assertFails(
      updateDoc(doc(banco('tecnico'), 'assistenteLog/log'), {
        feedback: 'util',
      }),
    )
    await assertFails(
      updateDoc(doc(banco('inativo'), 'assistenteLog/log'), {
        feedback: 'util',
      }),
    )
    await assertFails(
      updateDoc(doc(banco('anonimo'), 'assistenteLog/log'), {
        feedback: 'util',
      }),
    )
  })
})

describe('matriz de permissões: cobertura das regras', () => {
  it('toda coleção das regras está coberta pela matriz (acrescentou uma? acrescente as linhas)', () => {
    const regras = readFileSync('firestore.rules', 'utf8')
    const nasRegras = [...regras.matchAll(/^ {4}match \/(\w+)\/\{/gm)].map(
      (m) => m[1]!,
    )
    // Coleções que as linhas de leitura e escrita acima exercitam.
    const cobertas = new Set([
      'users',
      'unidades',
      'sincronizacoes',
      'fontes',
      'blocks',
      'articles',
      'searchIndex',
      'searchIndexTecnico',
      'searchMisses',
      'searchFeedback',
      'assistenteUso',
      'assistenteLog',
      'auditLog',
      'preferenciasUsuario',
    ])
    const semCobertura = nasRegras.filter((c) => !cobertas.has(c))
    expect(
      semCobertura,
      `coleções sem linha na matriz: ${semCobertura.join(', ')}`,
    ).toEqual([])
    expect(nasRegras.length).toBe(cobertas.size)
  })

  it('as regras terminam negando tudo o que não foi previsto', () => {
    const regras = readFileSync('firestore.rules', 'utf8')
    expect(regras).toMatch(
      /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/,
    )
  })
})
