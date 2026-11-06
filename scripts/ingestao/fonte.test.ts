// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashDoConteudo, lerTexto, prepararDocumento, varrer } from './fonte.ts'
import { resumirMudancas } from './mudancas.ts'

let pasta: string
beforeAll(async () => {
  pasta = await mkdtemp(path.join(tmpdir(), 'ingestao-'))
  await mkdir(path.join(pasta, 'guias', 'avancado'), { recursive: true })
  await mkdir(path.join(pasta, '.git'))
  await mkdir(path.join(pasta, 'node_modules'))
  await writeFile(path.join(pasta, 'a.md'), '# A\n')
  await writeFile(path.join(pasta, 'b.TXT'), 'b')
  await writeFile(path.join(pasta, 'guias', 'c.html'), '<p>c</p>')
  await writeFile(path.join(pasta, 'guias', 'avancado', 'd.md'), 'd')
  await writeFile(path.join(pasta, 'manual.docx'), 'x')
  await writeFile(path.join(pasta, 'manual.pdf'), 'x')
  await writeFile(path.join(pasta, 'foto.png'), 'x')
  await writeFile(path.join(pasta, '.oculto.md'), 'x')
  await writeFile(path.join(pasta, '.git', 'x.md'), 'x')
  await writeFile(path.join(pasta, 'node_modules', 'y.md'), 'x')
})
afterAll(() => rm(pasta, { recursive: true, force: true }))

describe('varrer', () => {
  it('lista .md, .html e .txt (inclusive em subpastas) e ignora o resto', async () => {
    const v = await varrer(pasta)
    expect(v.arquivos.map((a) => [a.caminho, a.formato])).toEqual([
      ['a.md', 'markdown'],
      ['b.TXT', 'texto'],
      ['guias/avancado/d.md', 'markdown'],
      ['guias/c.html', 'html'],
    ])
  })

  it('relata .docx e .pdf como ainda sem leitura, e outras extensões como sem suporte', async () => {
    const v = await varrer(pasta)
    expect(v.ignorados).toEqual([
      { caminho: 'foto.png', motivo: 'extensão .png sem suporte' },
      {
        caminho: 'manual.docx',
        motivo: 'formato .docx ainda não é lido pela ingestão',
      },
      {
        caminho: 'manual.pdf',
        motivo: 'formato .pdf ainda não é lido pela ingestão',
      },
    ])
  })
})

describe('hashDoConteudo e lerTexto', () => {
  it('o hash ignora espaços nas pontas e o texto lido normaliza BOM e CRLF', async () => {
    expect(hashDoConteudo('olá\n')).toBe(hashDoConteudo('  olá'))
    expect(hashDoConteudo('a')).not.toBe(hashDoConteudo('b'))
    await writeFile(path.join(pasta, 'win.md'), '﻿# T\r\ntexto\r\n')
    expect(await lerTexto(pasta, 'win.md')).toBe('# T\ntexto\n')
  })
})

describe('prepararDocumento', () => {
  it('Markdown: título do front matter, ou do H1 (que sai do corpo), ou do nome do arquivo', () => {
    expect(
      prepararDocumento(
        '---\ntitulo: Do front\n---\n# Outro\ntexto',
        'markdown',
        'x.md',
      ).titulo,
    ).toBe('Do front')
    const h1 = prepararDocumento('# Meu título\n\ntexto', 'markdown', 'x.md')
    expect(h1.titulo).toBe('Meu título')
    expect(h1.conteudo).not.toContain('# Meu título')
    expect(
      prepararDocumento('só texto', 'markdown', 'guia-de-uso_rapido.md').titulo,
    ).toBe('Guia de uso rapido')
  })

  it('Markdown: limita os títulos a H3', () => {
    expect(
      prepararDocumento('## a\n#### b\n###### c', 'markdown', 'x.md').conteudo,
    ).toBe('## a\n### b\n### c\n')
  })

  it('HTML: título do H1 ou do <title>, e só o conteúdo do <body>', () => {
    const d = prepararDocumento(
      '<html><head><title>Aba</title></head><body><h1>Cabeça <b>X</b></h1><p>corpo</p></body></html>',
      'html',
      'x.html',
    )
    expect(d.titulo).toBe('Cabeça X')
    expect(d.conteudo).not.toContain('<title>')
    expect(
      prepararDocumento('<title>Só aba</title><p>x</p>', 'html', 'x.html')
        .titulo,
    ).toBe('Só aba')
  })

  it('texto puro: primeira linha curta vira o título e os blocos viram parágrafos escapados', () => {
    const d = prepararDocumento(
      'Título curto\nlinha 2\n\nSegundo <b> & mais',
      'texto',
      'x.txt',
    )
    expect(d.titulo).toBe('Título curto')
    expect(d.formato).toBe('html')
    expect(d.conteudo).toBe(
      '<p>Título curto<br>linha 2</p>\n<p>Segundo &lt;b&gt; &amp; mais</p>',
    )
    const longo = prepararDocumento(
      `${'x'.repeat(150)}\n\nfim`,
      'texto',
      'nota-solta.txt',
    )
    expect(longo.titulo).toBe('Nota solta')
  })
})

describe('resumirMudancas', () => {
  const doc = (...textos: string[]) => ({
    type: 'doc',
    content: textos.map((t) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: t }],
    })),
  })

  it('conta blocos novos e removidos e avisa de mudança de título', () => {
    const r = resumirMudancas(
      { titulo: 'A', conteudo: doc('um', 'dois', 'três') },
      { titulo: 'B', conteudo: doc('um', 'dois', 'quatro', 'cinco') },
    )
    expect(r).toEqual([
      'Título: "A" → "B"',
      '2 bloco(s) de texto novo(s) ou alterado(s)',
      '1 bloco(s) removido(s) ou alterado(s)',
    ])
  })

  it('sem diferença de blocos, avisa que é só formatação', () => {
    const r = resumirMudancas(
      { titulo: 'A', conteudo: doc('um', 'dois') },
      { titulo: 'A', conteudo: doc('dois', 'um') },
    )
    expect(r).toEqual(['Mudança só de formatação ou de ordem'])
  })
})
