import type { Relatorio } from './types.ts'

function secao<T>(titulo: string, itens: T[], linha: (i: T) => string): string {
  if (itens.length === 0) return `## ${titulo}\n\nNenhum.\n`
  return `## ${titulo} (${itens.length})\n\n${itens.map((i) => `- ${linha(i)}`).join('\n')}\n`
}

export function relatorioEmMarkdown(r: Relatorio, simulacao: boolean): string {
  const { resumo } = r
  return [
    `# Relatório de migração${simulacao ? ' (simulação, nada foi gravado)' : ''}`,
    '',
    `- Blocos: ${resumo.blocos}`,
    `- Artigos: ${resumo.artigos} (${resumo.publicados} publicados, ${resumo.rascunhos} rascunhos)`,
    `- Imagens migradas: ${resumo.imagensOk}`,
    `- Imagens com falha: ${resumo.imagensComFalha}`,
    ...(resumo.imagensPuladas
      ? [
          `- Imagens puladas (\`--sem-imagens\`): ${resumo.imagensPuladas}. Cada uma virou o texto \`[Imagem não migrada: …]\` no artigo; para trazê-las depois, importe de novo sem a opção e com \`--sobrescrever\`.`,
        ]
      : []),
    `- Links quebrados: ${resumo.linksQuebrados}`,
    `- Artigos sem bloco: ${resumo.artigosSemBloco}`,
    `- Artigos com erro: ${r.erros.length}`,
    '',
    secao(
      'Imagens com falha',
      r.imagensComFalha,
      (i) => `\`${i.artigo}\`: ${i.src} — ${i.motivo}`,
    ),
    secao(
      'Links quebrados',
      r.linksQuebrados,
      (i) => `\`${i.artigo}\`: ${i.href} — ${i.motivo}`,
    ),
    secao(
      'Artigos sem bloco',
      r.artigosSemBloco,
      (i) => `\`${i.id}\` "${i.titulo}" aponta para o bloco "${i.bloco}"`,
    ),
    secao('Artigos com erro', r.erros, (i) => `\`${i.artigo}\`: ${i.mensagem}`),
    secao(
      'Textos alternativos gerados (revisar)',
      r.altsGerados,
      (i) => `\`${i.artigo}\`: "${i.alt}" (${i.src})`,
    ),
    secao('Avisos', r.avisos, (i) => `\`${i.artigo}\`: ${i.mensagem}`),
  ].join('\n')
}

/** Há algo que exige atenção antes do desligamento da ferramenta antiga? */
export function temPendencias(r: Relatorio): boolean {
  return (
    r.imagensComFalha.length +
      r.linksQuebrados.length +
      r.artigosSemBloco.length +
      r.erros.length >
    0
  )
}
