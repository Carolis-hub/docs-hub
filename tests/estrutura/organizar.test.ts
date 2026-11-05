import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { beforeEach, describe, expect, it } from 'vitest'
import { organizarUnidade } from '../../scripts/estrutura/organizar'

const db = () =>
  getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-docs-hub' }))

const bloco = (nome: string, extra: Record<string, unknown> = {}) => ({
  nome,
  slug: nome.toLowerCase().replace(/\s+/g, '-'),
  parentId: null,
  ...extra,
})

beforeEach(async () => {
  await fetch(
    'http://127.0.0.1:8080/emulator/v1/projects/demo-docs-hub/databases/(default)/documents',
    { method: 'DELETE' },
  )
  const d = db()
  await d.doc('blocks/ss4').set(bloco('SmartShare 4'))
  await d.doc('blocks/di').set(bloco('SmartShare DI'))
  await d.doc('blocks/outro').set(bloco('Outro', { unidadeId: 'u-x' }))
  await d.doc('blocks/filho').set({ nome: 'Filho', parentId: 'ss4' })
})

const base = { nome: 'Process Solution', semUnidade: false, gravar: true }

describe('organizarUnidade', () => {
  it('simulação não grava nada', async () => {
    const r = await organizarUnidade(db(), {
      ...base,
      produtos: ['ss4'],
      gravar: false,
    })
    expect(r.unidadeCriada).toBe(true)
    expect(r.produtos[0]?.status).toBe('ligado')
    expect((await db().doc('unidades/u-process-solution').get()).exists).toBe(
      false,
    )
    expect(
      (await db().doc('blocks/ss4').get()).get('unidadeId'),
    ).toBeUndefined()
  })

  it('cria a unidade e liga o produto por id, nome ou slug', async () => {
    const r = await organizarUnidade(db(), {
      ...base,
      descricao: 'BU de ECM',
      produtos: ['ss4', 'smartshare di'],
    })
    expect(r.unidadeId).toBe('u-process-solution')
    expect(r.produtos.map((p) => p.status)).toEqual(['ligado', 'ligado'])
    const u = await db().doc('unidades/u-process-solution').get()
    expect(u.data()).toMatchObject({
      nome: 'Process Solution',
      descricao: 'BU de ECM',
      ordem: 0,
    })
    expect((await db().doc('blocks/ss4').get()).get('unidadeId')).toBe(
      'u-process-solution',
    )
    expect((await db().doc('blocks/di').get()).get('unidadeId')).toBe(
      'u-process-solution',
    )
  })

  it('rodar de novo não duplica nem muda a ordem', async () => {
    await organizarUnidade(db(), { ...base, produtos: ['ss4'] })
    const r = await organizarUnidade(db(), { ...base, produtos: ['ss4'] })
    expect(r.unidadeCriada).toBe(false)
    expect(r.produtos[0]?.status).toBe('ja-estava')
    expect((await db().collection('unidades').get()).size).toBe(1)
  })

  it('não move produto de outra unidade e avisa o que não achou', async () => {
    const r = await organizarUnidade(db(), {
      ...base,
      produtos: ['Outro', 'nao-existe', 'filho'],
    })
    expect(r.produtos.map((p) => p.status)).toEqual([
      'outra-unidade',
      'nao-encontrado',
      'nao-encontrado', // subproduto não é produto
    ])
    expect((await db().doc('blocks/outro').get()).get('unidadeId')).toBe('u-x')
  })

  it('--sem-unidade liga só os produtos soltos', async () => {
    const r = await organizarUnidade(db(), {
      ...base,
      produtos: [],
      semUnidade: true,
    })
    expect(r.produtos.map((p) => p.id).sort()).toEqual(['di', 'ss4'])
    expect((await db().doc('blocks/outro').get()).get('unidadeId')).toBe('u-x')
    expect(
      (await db().doc('blocks/filho').get()).get('unidadeId'),
    ).toBeUndefined()
  })
})
