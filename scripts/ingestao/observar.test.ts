// @vitest-environment node
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { impressaoDaPasta, observar } from './observar.ts'

let pasta: string
beforeAll(async () => {
  pasta = await mkdtemp(path.join(tmpdir(), 'observar-'))
  await mkdir(path.join(pasta, 'sub'))
  await writeFile(path.join(pasta, 'a.md'), '# A')
})
afterAll(() => rm(pasta, { recursive: true, force: true }))

describe('impressaoDaPasta', () => {
  it('é a mesma enquanto nada muda e muda com arquivo novo, alterado ou removido', async () => {
    const base = await impressaoDaPasta(pasta)
    expect(await impressaoDaPasta(pasta)).toBe(base)

    await writeFile(path.join(pasta, 'sub', 'b.txt'), 'novo')
    const comNovo = await impressaoDaPasta(pasta)
    expect(comNovo).not.toBe(base)

    await writeFile(path.join(pasta, 'sub', 'b.txt'), 'novo, maior')
    const alterado = await impressaoDaPasta(pasta)
    expect(alterado).not.toBe(comNovo)

    await utimes(
      path.join(pasta, 'a.md'),
      new Date(2020, 1, 1),
      new Date(2020, 1, 1),
    )
    expect(await impressaoDaPasta(pasta)).not.toBe(alterado)

    await rm(path.join(pasta, 'sub', 'b.txt'))
    await utimes(
      path.join(pasta, 'a.md'),
      new Date(2020, 1, 1),
      new Date(2020, 1, 1),
    )
    expect(await impressaoDaPasta(pasta)).not.toBe(comNovo)
  })

  it('ignora o que a ingestão não lê (pdf, imagens, pastas ocultas)', async () => {
    const antes = await impressaoDaPasta(pasta)
    await writeFile(path.join(pasta, 'manual.pdf'), 'x')
    await writeFile(path.join(pasta, 'foto.png'), 'x')
    await mkdir(path.join(pasta, '.git'), { recursive: true })
    await writeFile(path.join(pasta, '.git', 'x.md'), 'x')
    expect(await impressaoDaPasta(pasta)).toBe(antes)
  })
})

describe('observar', () => {
  /** Roda a vigília por `voltas` voltas, executando `entreVoltas(n)` antes de cada espera. */
  async function vigiar(
    voltas: number,
    entreVoltas: (n: number) => Promise<void>,
    executar: () => Promise<void>,
    extras: Partial<Parameters<typeof observar>[0]> = {},
  ) {
    const controle = new AbortController()
    let volta = 0
    await observar({
      pasta,
      intervaloMs: 1,
      executar,
      sinal: controle.signal,
      esperar: async () => {
        volta++
        if (volta >= voltas) controle.abort()
        else await entreVoltas(volta)
      },
      ...extras,
    })
  }

  it('roda na primeira volta e só volta a rodar quando a pasta muda', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'observar2-'))
    await writeFile(path.join(dir, 'um.md'), '# 1')
    let execucoes = 0
    let semMudanca = 0
    const controle = new AbortController()
    let volta = 0
    await observar({
      pasta: dir,
      intervaloMs: 1,
      executar: async () => void execucoes++,
      aoSemMudanca: () => void semMudanca++,
      sinal: controle.signal,
      esperar: async () => {
        volta++
        if (volta === 3) await writeFile(path.join(dir, 'dois.md'), '# 2')
        if (volta >= 5) controle.abort()
      },
    })
    expect(execucoes).toBe(2)
    expect(semMudanca).toBe(3)
    await rm(dir, { recursive: true, force: true })
  })

  it('um erro não derruba a vigília: tenta a mesma mudança de novo na volta seguinte', async () => {
    let tentativas = 0
    const erros: unknown[] = []
    await vigiar(
      4,
      async () => {},
      async () => {
        tentativas++
        if (tentativas === 1) throw new Error('rede caiu')
      },
      { aoErro: (e) => erros.push(e) },
    )
    expect(tentativas).toBe(2)
    expect(erros).toHaveLength(1)
    expect((erros[0] as Error).message).toBe('rede caiu')
  })

  it('termina ao cancelar o sinal, mesmo durante a espera', async () => {
    const controle = new AbortController()
    const inicio = Date.now()
    const fim = observar({
      pasta,
      intervaloMs: 60_000,
      executar: async () => {},
      sinal: controle.signal,
    })
    setTimeout(() => controle.abort(), 20)
    await fim
    expect(Date.now() - inicio).toBeLessThan(5000)
  })
})
