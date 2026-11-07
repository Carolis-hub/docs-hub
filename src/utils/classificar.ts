import type { CategoriaId, Classificacao } from '../types/content'
import { normalizar } from './search.ts'

interface Entrada {
  titulo: string
  /** Caminho do arquivo de origem: as pastas costumam dizer o assunto. */
  caminho: string
  /** Markdown ou texto do documento (blocos de código contam como sinal técnico). */
  texto: string
}

const PALAVRAS: Record<CategoriaId, string[]> = {
  configuracoes: [
    'configur',
    'parametr',
    'habilit',
    'instalac',
    'setup',
    'ajuste',
    'permiss',
    'personaliz',
  ],
  processos: [
    'passo a passo',
    'fluxo',
    'processo',
    'etapa',
    'procedimento',
    'como fazer',
    'workflow',
    'rotina',
    'tutorial',
  ],
  'regras-de-negocio': [
    'regra',
    'validac',
    'restric',
    'politica',
    'limite',
    'obrigatori',
    'nao e permitido',
    'criterio',
    'nao pode',
  ],
  funcionalidades: [
    'funcionalidade',
    'recurso',
    'tela',
    'botao',
    'menu',
    'cadastro',
    'relatorio',
    'permite',
    'visualiz',
    'pesquis',
  ],
}

const TECNICOS = [
  'api',
  'endpoint',
  'sql',
  'json',
  'xml',
  'http',
  'token',
  'stack trace',
  'log',
  'script',
  'powershell',
  'classe',
  'metodo',
  'jdbc',
  'query',
  'regex',
  'webservice',
  'soap',
  'rest',
  'deploy',
  'docker',
  'kubernetes',
  'banco de dados',
  'servidor',
]

const contar = (texto: string, termo: string) => {
  let n = 0
  for (let i = texto.indexOf(termo); i >= 0; i = texto.indexOf(termo, i + 1))
    n++
  return n
}

/** Conta um termo só quando ele aparece como palavra inteira (evita "log" em "catalogo"). */
const contarPalavra = (texto: string, termo: string) =>
  (texto.match(new RegExp(`(?<![a-z0-9])${termo}(?![a-z0-9])`, 'g')) ?? [])
    .length

/**
 * Sugere categoria e público de um documento por regras simples (palavras no
 * título, no caminho, nos títulos internos e no começo do texto). Não é IA e
 * erra: o resultado é só uma sugestão que o revisor confirma ou troca.
 */
export function classificarDocumento(e: Entrada): Classificacao {
  const titulo = normalizar(e.titulo)
  const caminho = normalizar(e.caminho)
  const texto = normalizar(e.texto)
  const titulosInternos = (texto.match(/^#{1,6} .*$/gm) ?? []).join('\n')
  const inicio = texto.slice(0, 800)

  const pontos = {} as Record<CategoriaId, number>
  const motivos: string[] = []
  for (const [id, termos] of Object.entries(PALAVRAS) as Array<
    [CategoriaId, string[]]
  >) {
    let total = 0
    for (const t of termos) {
      if (titulo.includes(t)) total += 3
      if (caminho.includes(t)) total += 2
      if (titulosInternos.includes(t)) total += 2
      if (inicio.includes(t)) total += 1
    }
    pontos[id] = total
  }
  const ordenadas = (
    Object.entries(pontos) as Array<[CategoriaId, number]>
  ).sort((a, b) => b[1] - a[1])
  const [melhor, segundo] = [ordenadas[0]!, ordenadas[1]!]
  let categoria: CategoriaId | '' = ''
  let confianca: Classificacao['confianca'] = 'baixa'
  if (melhor[1] >= 3 && melhor[1] - segundo[1] >= 2) {
    categoria = melhor[0]
    confianca = melhor[1] >= 6 ? 'alta' : 'media'
    motivos.push(
      `categoria "${melhor[0]}" pelas palavras do título, caminho e texto`,
    )
  } else {
    motivos.push('sem sinal claro para a categoria')
  }

  const blocosDeCodigo = Math.floor((texto.match(/```/g) ?? []).length / 2)
  const palavras = texto.split(/\s+/).filter(Boolean).length || 1
  let sinaisTecnicos = blocosDeCodigo * 3
  for (const t of TECNICOS) {
    sinaisTecnicos += t.includes(' ')
      ? contar(texto, t)
      : contarPalavra(texto, t)
  }
  const densidade = sinaisTecnicos / palavras
  const conteudo: Classificacao['conteudo'] =
    sinaisTecnicos >= 8 && densidade >= 0.03
      ? 'tecnico'
      : sinaisTecnicos >= 3
        ? 'misto'
        : 'funcional'
  if (conteudo !== 'funcional') {
    motivos.push(
      `conteúdo ${conteudo}: ${blocosDeCodigo} bloco(s) de código e ${sinaisTecnicos - blocosDeCodigo * 3} termo(s) técnico(s)`,
    )
  }

  return {
    conteudo,
    confianca,
    categoria,
    // Técnico e misto ficam restritos a quem pode ver conteúdo técnico; o
    // revisor libera para todos se o texto for só de usuário.
    publico: conteudo === 'funcional' ? 'usuario' : 'tecnico',
    motivos,
  }
}
