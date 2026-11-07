import type { EstadoArquivo, ResultadoIngestao } from './ingerir.ts'

const TITULOS: Record<EstadoArquivo, string> = {
  novo: 'Novos (entram na fila de revisão)',
  alterado: 'Alterados na origem',
  reapareceu: 'Reapareceram na origem',
  duplicado: 'Repetidos (mesmo conteúdo de outro arquivo)',
  removido: 'Removidos da origem (avaliar despublicação)',
  erro: 'Com erro (rodar de novo tenta outra vez)',
  ignorado: 'Ignorados',
  'sem-alteracao': 'Sem alteração',
}

const DESTINOS = {
  criado: 'criado na fila de revisão',
  'atualizado-na-fila': 'item da fila atualizado',
  'revisao-pendente': 'sugestão pendente (versão publicada mantida)',
  'sem-mudanca-real': 'conteúdo igual ao do artigo',
} as const

export function relatorioDaIngestao(
  r: ResultadoIngestao,
  simulacao: boolean,
): string {
  const linhas = [
    `# Relatório de ingestão — ${r.fonteId}${simulacao ? ' (simulação, nada foi gravado)' : ''}`,
    '',
    ...(Object.keys(TITULOS) as EstadoArquivo[]).map(
      (e) => `- ${TITULOS[e]}: ${r.contagem[e]}`,
    ),
    '',
  ]
  for (const estado of Object.keys(TITULOS) as EstadoArquivo[]) {
    if (estado === 'sem-alteracao') continue
    const itens = r.arquivos.filter((a) => a.estado === estado)
    if (itens.length === 0) continue
    linhas.push(`## ${TITULOS[estado]} (${itens.length})`, '')
    for (const a of itens) {
      const extras = [
        a.destino && DESTINOS[a.destino],
        a.classificacao &&
          (estado === 'novo' || estado === 'alterado') &&
          `sugerido: ${a.classificacao.categoria || 'sem categoria'}, ${a.classificacao.conteudo} (confiança ${a.classificacao.confianca})`,
        a.detalhe,
      ].filter(Boolean)
      linhas.push(
        `- \`${a.caminho}\`${extras.length ? ` — ${extras.join('; ')}` : ''}`,
      )
    }
    linhas.push('')
  }
  const { imagensComFalha, linksQuebrados, avisos } = r.conversao
  for (const [titulo, itens] of [
    [
      'Imagens com falha',
      imagensComFalha.map((i) => `\`${i.artigo}\`: ${i.src} — ${i.motivo}`),
    ],
    [
      'Links quebrados',
      linksQuebrados.map((i) => `\`${i.artigo}\`: ${i.href} — ${i.motivo}`),
    ],
    [
      'Avisos de conversão',
      avisos.map((i) => `\`${i.artigo}\`: ${i.mensagem}`),
    ],
  ] as const) {
    if (itens.length === 0) continue
    linhas.push(
      `## ${titulo} (${itens.length})`,
      '',
      ...itens.map((i) => `- ${i}`),
      '',
    )
  }
  return linhas.join('\n')
}
