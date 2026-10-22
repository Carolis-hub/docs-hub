// @vitest-environment node
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const executar = promisify(execFile)

// Os scripts rodam direto no Node (sem Vite): importações sem a extensão `.ts`
// quebram só aqui, e o vitest e o tsc não pegam.
describe('CLIs rodam no Node puro', () => {
  it.each([
    ['scripts/migrate/index.ts', /Uso: node scripts\/migrate/],
    ['scripts/doc-sync/index.ts', /Uso: node scripts\/doc-sync/],
    [
      'scripts/migrate/adaptadores/smartshare-kb.ts',
      /Uso: node scripts\/migrate\/adaptadores/,
    ],
  ])('%s', async (script, saida) => {
    // Sem argumentos o adaptador mostra o uso e sai com 2: lê a saída mesmo assim.
    const { stdout } = await executar(process.execPath, [
      script,
      ...(script.includes('adaptadores') ? [] : ['--ajuda']),
    ]).catch((e: { stdout: string }) => e)
    expect(stdout).toMatch(saida)
  })
})
