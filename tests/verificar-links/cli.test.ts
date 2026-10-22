import { execFile } from 'node:child_process'
import { mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const executar = promisify(execFile)
const db = () =>
  getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-docs-hub' }))

const limpar = () =>
  fetch(
    'http://127.0.0.1:8080/emulator/v1/projects/demo-docs-hub/databases/(default)/documents',
    {
      method: 'DELETE',
    },
  )

const conteudo = (...hrefs: string[]) => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: hrefs.map((href) => ({
        type: 'text',
        text: 'l',
        marks: [{ type: 'link', attrs: { href } }],
      })),
    },
  ],
})

beforeAll(async () => {
  await limpar()
  await db().collection('blocks').doc('p1').set({ nome: 'P', parentId: null })
  await db()
    .collection('articles')
    .doc('a1')
    .set({
      titulo: 'Bom',
      status: 'published',
      conteudo: conteudo('/a/a2', '/b/p1'),
    })
  await db()
    .collection('articles')
    .doc('a2')
    .set({
      titulo: 'Quebrado',
      status: 'published',
      conteudo: conteudo('/a/sumiu'),
    })
})

afterAll(limpar)

describe('verificar-links (CLI contra o Emulator)', () => {
  it('lê o Firestore, relata o link quebrado e sai com 1 em modo estrito', async () => {
    const saida = await mkdtemp(path.join(os.tmpdir(), 'links-'))
    const r = await executar(
      process.execPath,
      [
        'scripts/verificar-links/index.ts',
        '--projeto',
        'demo-docs-hub',
        '--sem-externos',
        '--estrito',
        '--saida',
        saida,
      ],
      { env: process.env },
    ).catch((e: { code: number; stdout: string }) => e)
    expect((r as { code: number }).code).toBe(1)
    expect(r.stdout).toContain('2 artigos')
    expect(r.stdout).toContain('1 quebrados')
    const md = await readFile(path.join(saida, 'relatorio-links.md'), 'utf8')
    expect(md).toContain(
      '[Quebrado](/a/a2) | link | /a/sumiu | o artigo não existe mais',
    )
    expect(md).not.toContain('[Bom]')
  })

  it('sem o modo estrito, sai com 0 mesmo havendo links quebrados', async () => {
    const saida = await mkdtemp(path.join(os.tmpdir(), 'links-'))
    const r = await executar(
      process.execPath,
      [
        'scripts/verificar-links/index.ts',
        '--projeto',
        'demo-docs-hub',
        '--sem-externos',
        '--saida',
        saida,
      ],
      { env: process.env },
    )
    expect(r.stdout).toContain('1 quebrados')
  })
})
