import { getApps, initializeApp } from 'firebase-admin/app'
import { GeoPoint, Timestamp, getFirestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  deJson,
  exportarFirestore,
  restaurar,
  paraJson,
} from '../../scripts/backup/backup'
import { cifrar, decifrar } from '../../scripts/backup/cripto'

const db = () =>
  getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-docs-hub' }))

async function limpar() {
  await fetch(
    'http://127.0.0.1:8080/emulator/v1/projects/demo-docs-hub/databases/(default)/documents',
    { method: 'DELETE' },
  )
}

beforeAll(async () => {
  await limpar()
  const d = db()
  await d
    .collection('blocks')
    .doc('p1')
    .set({ nome: 'Produto', parentId: null })
  await d
    .collection('articles')
    .doc('a1')
    .set({
      titulo: 'Artigo',
      conteudo: { type: 'doc', content: [{ type: 'paragraph' }] },
      criado: Timestamp.fromMillis(1_700_000_000_123),
      local: new GeoPoint(-23.5, -46.6),
      bloco: d.doc('blocks/p1'),
      anexo: Buffer.from('oi'),
    })
  await d.collection('articles/a1/versions').doc('1').set({ versao: 1 })
  await d
    .collection('articles/a1/suggestions')
    .doc('s1')
    .set({ status: 'pending' })
  await d
    .collection('users')
    .doc('u1')
    .set({ nome: 'Ana', role: 'admin', aiKey: 'sk-segredo', aiProvider: 'x' })
})

afterAll(limpar)

describe('backup do Firestore (Emulator)', () => {
  it('exporta coleções e subcoleções e remove as chaves de IA', async () => {
    const b = await exportarFirestore(
      db(),
      'demo-docs-hub',
      new Date('2026-01-02T03:04:05Z'),
    )
    expect(b).toMatchObject({
      formato: 'docs-hub-backup/1',
      projeto: 'demo-docs-hub',
      geradoEm: '2026-01-02T03:04:05.000Z',
    })
    expect(b.documentos.map((x) => x.caminho).sort()).toEqual([
      'articles/a1',
      'articles/a1/suggestions/s1',
      'articles/a1/versions/1',
      'blocks/p1',
      'users/u1',
    ])
    const usuario = b.documentos.find((x) => x.caminho === 'users/u1')
    expect(usuario?.dados).toEqual({
      nome: 'Ana',
      role: 'admin',
      aiProvider: 'x',
    })
    expect(b.redigidos).toEqual(['users.*.aiKey'])
    expect(JSON.stringify(b)).not.toContain('sk-segredo')
  })

  it('preserva os tipos especiais do Firestore', async () => {
    const b = await exportarFirestore(db(), 'demo-docs-hub', new Date())
    const a1 = b.documentos.find((x) => x.caminho === 'articles/a1')?.dados
    expect(a1?.criado).toEqual({
      __tipo: 'timestamp',
      segundos: 1_700_000_000,
      nanos: 123_000_000,
    })
    expect(a1?.local).toEqual({
      __tipo: 'geopoint',
      latitude: -23.5,
      longitude: -46.6,
    })
    expect(a1?.bloco).toEqual({ __tipo: 'ref', caminho: 'blocks/p1' })
    const volta = deJson(
      JSON.parse(JSON.stringify(paraJson({ t: Timestamp.fromMillis(5) }))),
      db(),
    ) as { t: Timestamp }
    expect(volta.t.toMillis()).toBe(5)
  })

  it('restaura em um banco vazio, passando pela cifragem', async () => {
    const original = await exportarFirestore(db(), 'demo-docs-hub', new Date())
    const arquivo = cifrar(Buffer.from(JSON.stringify(original)), 'senha')
    const backup = JSON.parse(decifrar(arquivo, 'senha').toString('utf8'))
    await limpar()

    const simulado = await restaurar(db(), backup, {
      gravar: false,
      sobrescrever: false,
    })
    expect(simulado).toEqual({ gravados: 5, pulados: 0 })
    expect((await db().collection('blocks').get()).size).toBe(0)

    await restaurar(db(), backup, { gravar: true, sobrescrever: false })
    const a1 = (await db().collection('articles').doc('a1').get()).data()
    expect(a1?.titulo).toBe('Artigo')
    expect((a1?.criado as Timestamp).toMillis()).toBe(1_700_000_000_123)
    expect(a1?.bloco.path).toBe('blocks/p1')
    expect(Buffer.from(a1?.anexo).toString()).toBe('oi')
    expect((await db().collection('articles/a1/versions').get()).size).toBe(1)
    expect(
      (await db().collection('users').doc('u1').get()).data(),
    ).not.toHaveProperty('aiKey')
  })

  it('não sobrescreve o que já existe, a não ser que se peça', async () => {
    const backup = await exportarFirestore(db(), 'demo-docs-hub', new Date())
    await db()
      .collection('blocks')
      .doc('p1')
      .update({ nome: 'Alterado depois do backup' })

    const r = await restaurar(db(), backup, {
      gravar: true,
      sobrescrever: false,
    })
    expect(r).toEqual({ gravados: 0, pulados: 5 })
    expect((await db().collection('blocks').doc('p1').get()).data()?.nome).toBe(
      'Alterado depois do backup',
    )

    await restaurar(db(), backup, { gravar: true, sobrescrever: true })
    expect((await db().collection('blocks').doc('p1').get()).data()?.nome).toBe(
      'Produto',
    )
  })

  it('recusa um formato desconhecido', async () => {
    await expect(
      restaurar(db(), { formato: 'outro' } as never, {
        gravar: true,
        sobrescrever: false,
      }),
    ).rejects.toThrow(/Formato de backup desconhecido/)
  })
})
