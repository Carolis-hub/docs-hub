import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { criarResolvedorImagens } from './images.ts'
import { criarVerificadorDeLinks } from './links.ts'
import { validarManifesto } from './manifest.ts'
import { planejar } from './plan.ts'
import { relatorioEmMarkdown, temPendencias } from './report.ts'
import type { ManifestoArtigo } from './types.ts'
import { gravar } from './write.ts'

const AJUDA = `Uso: node scripts/migrate/index.ts <pasta-do-export> [opções]

  --gravar              Grava no Firestore e envia as imagens (sem isto é simulação)
  --projeto <id>        Projeto Firebase (ou FIREBASE_PROJECT_ID / VITE_FIREBASE_PROJECT_ID)
  --sem-imagens         Importa só o texto: não baixa nem envia imagens (não pede o Cloudinary)
  --rest                Grava por REST em vez de gRPC (para redes com proxy/firewall que travam)
  --sobrescrever        Substitui artigos e blocos que já existem (mantém views)
  --verificar-links     Confere links externos (faz requisições HTTP)
  --autor <uid>         Autor gravado nos artigos (padrão: migracao)
  --saida <pasta>       Onde salvar relatório e cache (padrão: <pasta-do-export>/.migracao)
  --estrito             Sai com código 1 se o relatório tiver pendências

Cloudinary (só com --gravar, e dispensado com --sem-imagens): CLOUDINARY_CLOUD_NAME
e CLOUDINARY_UPLOAD_PRESET.
Firestore: GOOGLE_APPLICATION_CREDENTIALS, ou FIRESTORE_EMULATOR_HOST para testes.
`

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      gravar: { type: 'boolean', default: false },
      projeto: { type: 'string' },
      sobrescrever: { type: 'boolean', default: false },
      'sem-imagens': { type: 'boolean', default: false },
      rest: { type: 'boolean', default: false },
      'verificar-links': { type: 'boolean', default: false },
      autor: { type: 'string', default: 'migracao' },
      saida: { type: 'string' },
      estrito: { type: 'boolean', default: false },
      ajuda: { type: 'boolean', default: false },
    },
  })
  const pasta = positionals[0]
  if (values.ajuda || !pasta) {
    console.log(AJUDA)
    return values.ajuda ? 0 : 2
  }
  const baseDir = path.resolve(pasta)
  const saida = path.resolve(values.saida ?? path.join(baseDir, '.migracao'))
  const simulacao = !values.gravar

  let bruto: unknown
  try {
    bruto = JSON.parse(
      await readFile(path.join(baseDir, 'manifesto.json'), 'utf8'),
    )
  } catch (e) {
    console.error(
      `Não foi possível ler manifesto.json em ${baseDir}: ${(e as Error).message}`,
    )
    return 2
  }
  const validado = validarManifesto(bruto)
  if (!('manifesto' in validado)) {
    console.error(
      'Manifesto inválido:\n' +
        validado.erros.map((e) => `  - ${e}`).join('\n'),
    )
    return 2
  }

  const projeto =
    values.projeto ??
    process.env.FIREBASE_PROJECT_ID ??
    process.env.VITE_FIREBASE_PROJECT_ID
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME ?? process.env.VITE_CLOUDINARY_CLOUD_NAME
  const preset =
    process.env.CLOUDINARY_UPLOAD_PRESET ??
    process.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!simulacao && !projeto) {
    console.error('Informe o projeto com --projeto <id> (use o dev primeiro).')
    return 2
  }
  if (!simulacao && !values['sem-imagens'] && (!cloudName || !preset)) {
    console.error(
      'Defina CLOUDINARY_CLOUD_NAME e CLOUDINARY_UPLOAD_PRESET para enviar as imagens.',
    )
    return 2
  }

  await mkdir(saida, { recursive: true })
  const arquivoCache = path.join(saida, 'cache-imagens.json')
  const cache = new Map<string, string>(
    Object.entries(
      await readFile(arquivoCache, 'utf8').then(JSON.parse, () => ({})),
    ) as Array<[string, string]>,
  )

  const agora = Date.now()
  const verificarLink = values['verificar-links']
    ? criarVerificadorDeLinks()
    : undefined
  const plano = await planejar(validado.manifesto, {
    agora,
    autorId: values.autor,
    verificarLink,
    lerConteudo: async (a: ManifestoArtigo) =>
      a.arquivo
        ? readFile(path.resolve(baseDir, a.arquivo), 'utf8')
        : (a.conteudo ?? ''),
    resolverImagem: criarResolvedorImagens({
      baseDir,
      cache,
      pular: values['sem-imagens'],
      cloudinary: simulacao
        ? null
        : { cloudName: cloudName as string, uploadPreset: preset as string },
    }),
  })

  await writeFile(
    arquivoCache,
    JSON.stringify(Object.fromEntries(cache), null, 2),
  )
  await writeFile(
    path.join(saida, 'relatorio.json'),
    JSON.stringify(plano.relatorio, null, 2),
  )
  await writeFile(
    path.join(saida, 'relatorio.md'),
    relatorioEmMarkdown(plano.relatorio, simulacao),
  )

  const { resumo } = plano.relatorio
  console.log(
    `${simulacao ? 'Simulação' : 'Plano'}: ${resumo.blocos} blocos, ${resumo.artigos} artigos, ` +
      `${resumo.imagensOk} imagens ok, ${resumo.imagensComFalha} com falha, ` +
      (resumo.imagensPuladas ? `${resumo.imagensPuladas} puladas, ` : '') +
      `${resumo.linksQuebrados} links quebrados, ${resumo.artigosSemBloco} artigos sem bloco, ` +
      `${plano.relatorio.erros.length} com erro.`,
  )

  if (!simulacao) {
    const r = await gravar(plano, {
      projectId: projeto as string,
      sobrescrever: values.sobrescrever,
      rest: values.rest,
      autorId: values.autor,
      agora,
    })
    console.log(
      `Gravado em ${projeto}: ${r.blocosGravados} blocos (${r.blocosPulados} já existiam), ` +
        `${r.artigosGravados} artigos (${r.artigosPulados} já existiam), ${r.indices} índices de busca` +
        (r.versoesRecriadas
          ? `, ${r.versoesRecriadas} versões do histórico recriadas.`
          : '.'),
    )
  }
  console.log(`Relatório: ${path.join(saida, 'relatorio.md')}`)
  return values.estrito && temPendencias(plano.relatorio) ? 1 : 0
}

main().then(
  (codigo) => process.exit(codigo),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
