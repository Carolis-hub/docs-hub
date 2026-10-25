import { parseArgs } from 'node:util'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { MODELO_PADRAO, criarProvedorAnthropic } from './ia.ts'
import { sugerirAltTextos } from './sugerir.ts'

const AJUDA = `Uso: node scripts/alt-texto/index.ts --projeto <id> (--artigo <id> | --todos) [opções]

Sugere textos alternativos melhores para as imagens dos artigos: as que estão
sem alt ou com o alt genérico do importador ("Imagem 2 do artigo …"). A IA vê a
imagem e o texto ao redor. Nada é alterado no artigo: o resultado vira uma
sugestão pendente, que um admin revisa na tela "Sugestões".

  --projeto <id>     Projeto Firebase (ou FIREBASE_PROJECT_ID)
  --artigo <id>      Artigo a processar (repetível)
  --todos            Todos os artigos publicados que tenham imagens com alt fraco
  --limite <n>       Processa no máximo n artigos (bom para começar pequeno)
  --revisar-todas    Reescreve também os alts que parecem bons
  --sem-imagem       Manda só o texto, sem a imagem (mais barato, bem pior)
  --modelo <id>      Modelo da IA (padrão ${MODELO_PADRAO}, ou ALT_TEXTO_MODEL)
  --gravar           Cria as sugestões (sem isto, roda a IA e só mostra o resultado)

Credenciais: ANTHROPIC_API_KEY e GOOGLE_APPLICATION_CREDENTIALS (ou
FIRESTORE_EMULATOR_HOST para testes). As imagens precisam estar em endereços
públicos (as do Cloudinary estão).
`

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      projeto: { type: 'string' },
      artigo: { type: 'string', multiple: true },
      todos: { type: 'boolean', default: false },
      limite: { type: 'string' },
      'revisar-todas': { type: 'boolean', default: false },
      'sem-imagem': { type: 'boolean', default: false },
      modelo: { type: 'string' },
      gravar: { type: 'boolean', default: false },
      ajuda: { type: 'boolean', default: false },
    },
  })
  if (values.ajuda) {
    console.log(AJUDA)
    return 0
  }
  const projeto = values.projeto ?? process.env.FIREBASE_PROJECT_ID
  if (!projeto)
    return erro(
      'Informe o projeto com --projeto <id> (ou FIREBASE_PROJECT_ID).',
    )
  if (!values.artigo?.length && !values.todos)
    return erro('Informe --artigo <id> ou --todos.')
  if (!process.env.ANTHROPIC_API_KEY) return erro('Defina ANTHROPIC_API_KEY.')

  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: projeto }))
  const resultados = await sugerirAltTextos(
    db,
    criarProvedorAnthropic({ modelo: values.modelo }),
    {
      artigos: values.artigo,
      todos: values.todos,
      limiteArtigos: values.limite ? Number(values.limite) : undefined,
      revisarTodas: values['revisar-todas'],
      semImagem: values['sem-imagem'],
      gravar: values.gravar,
      agora: Date.now(),
    },
  )

  let falhas = 0
  for (const r of resultados) {
    console.log(
      `\n${r.titulo} (${r.artigoId}) — ${r.imagens} imagem(ns): ${r.status}${r.detalhe ? ` — ${r.detalhe}` : ''}`,
    )
    r.mudancas?.forEach((m) => console.log(`  • ${m}`))
    if (r.status === 'erro' || r.status === 'artigo-nao-encontrado') falhas++
  }
  const criadas = resultados.filter((r) => r.status === 'criada').length
  console.log(
    values.gravar
      ? `\n${criadas} sugestão(ões) criada(s). Revise em "Sugestões" no docs-hub.`
      : '\nSimulação: nada foi gravado. Use --gravar para criar as sugestões.',
  )
  return falhas > 0 ? 1 : 0
}

function erro(msg: string): number {
  console.error(msg)
  return 2
}

main().then(
  (c) => process.exit(c),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
