import type { Manifesto, ManifestoArtigo, ManifestoBloco } from './types.ts'

const texto = (v: unknown): v is string =>
  typeof v === 'string' && v.trim() !== ''

/**
 * Valida a estrutura do manifesto. Artigos que apontam para um bloco
 * inexistente NÃO são erro aqui: entram no relatório como "sem bloco".
 */
export function validarManifesto(
  dados: unknown,
): { manifesto: Manifesto; erros: string[] } | { erros: string[] } {
  const erros: string[] = []
  if (typeof dados !== 'object' || dados === null) {
    return { erros: ['O manifesto precisa ser um objeto JSON.'] }
  }
  const { blocos, artigos } = dados as Record<string, unknown>
  if (!Array.isArray(blocos)) erros.push('`blocos` precisa ser uma lista.')
  if (!Array.isArray(artigos)) erros.push('`artigos` precisa ser uma lista.')
  if (erros.length) return { erros }

  const idsBlocos = new Set<string>()
  ;(blocos as ManifestoBloco[]).forEach((b, i) => {
    const onde = `blocos[${i}]`
    if (!texto(b?.id)) return void erros.push(`${onde}: falta \`id\`.`)
    if (!texto(b.nome)) erros.push(`${onde} (${b.id}): falta \`nome\`.`)
    if (idsBlocos.has(b.id)) erros.push(`${onde}: id duplicado "${b.id}".`)
    idsBlocos.add(b.id)
  })
  for (const b of blocos as ManifestoBloco[]) {
    if (b?.pai && !idsBlocos.has(b.pai)) {
      erros.push(`Bloco "${b.id}": pai "${b.pai}" não existe.`)
    }
  }
  // Ciclos: seguir os pais até a raiz, com limite de passos.
  const paiDe = new Map(
    (blocos as ManifestoBloco[]).map((b) => [b?.id, b?.pai ?? null]),
  )
  for (const id of idsBlocos) {
    let atual: string | null | undefined = id
    for (let passos = 0; atual; passos++) {
      if (passos > idsBlocos.size) {
        erros.push(`Bloco "${id}": hierarquia com ciclo.`)
        break
      }
      atual = paiDe.get(atual) ?? null
    }
  }

  const idsArtigos = new Set<string>()
  ;(artigos as ManifestoArtigo[]).forEach((a, i) => {
    const onde = `artigos[${i}]`
    if (!texto(a?.id)) return void erros.push(`${onde}: falta \`id\`.`)
    if (idsArtigos.has(a.id)) erros.push(`${onde}: id duplicado "${a.id}".`)
    idsArtigos.add(a.id)
    if (!texto(a.titulo)) erros.push(`${onde} (${a.id}): falta \`titulo\`.`)
    if (!!a.arquivo === (a.conteudo !== undefined)) {
      erros.push(
        `${onde} (${a.id}): use \`arquivo\` ou \`conteudo\`, um dos dois.`,
      )
    }
    if (a.formato && !['html', 'markdown'].includes(a.formato)) {
      erros.push(`${onde} (${a.id}): formato "${a.formato}" inválido.`)
    }
    if (a.publico && !['usuario', 'tecnico'].includes(a.publico)) {
      erros.push(`${onde} (${a.id}): público "${a.publico}" inválido.`)
    }
    if (a.atualizadoEm && Number.isNaN(Date.parse(a.atualizadoEm))) {
      erros.push(`${onde} (${a.id}): data "${a.atualizadoEm}" inválida.`)
    }
  })

  return erros.length ? { erros } : { manifesto: dados as Manifesto, erros: [] }
}
