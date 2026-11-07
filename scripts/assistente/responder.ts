import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import type {
  CodigoErroAssistente,
  FonteResposta,
  PedidoAssistente,
  RespostaAssistente,
} from '../../src/types/assistente.ts'
import type { ConfigAssistente } from './config.ts'
import { custoEstimado, somar, type UsoIA } from './custo.ts'
import { ErroIA, type ProvedorAssistente } from './ia.ts'
import type { DocumentoParaResposta } from './prompt.ts'
import {
  aplicarFiltros,
  carregarFontes,
  escopoDoUsuario,
  lerIndice,
  selecionarCandidatos,
} from './recuperar.ts'

/** Erro esperado, com o status HTTP e a mensagem que o usuário vê. */
export class ErroAssistente extends Error {
  readonly codigo: CodigoErroAssistente
  readonly status: number
  constructor(codigo: CodigoErroAssistente, mensagem: string, status: number) {
    super(mensagem)
    this.codigo = codigo
    this.status = status
  }
}

export interface DepsAssistente {
  db: Firestore
  ia: ProvedorAssistente
  config: ConfigAssistente
  /** Relógio injetável, para os testes. */
  agora?: () => number
}

const SEM_RESULTADO =
  'Não encontrei nada na documentação publicada que responda a essa pergunta. Tente usar outras palavras, ou escolha um produto ou categoria nos filtros.'

/** Dia no fuso de Brasília (AAAA-MM-DD): a cota zera à meia-noite de lá. */
export function diaDe(ms: number): string {
  return new Date(ms).toLocaleDateString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  })
}

/**
 * Reserva uma pergunta na cota do usuário e confere o teto de gasto do dia.
 * Devolve quantas perguntas ainda cabem hoje depois desta.
 */
async function reservarCota(
  deps: DepsAssistente,
  uid: string,
  dia: string,
): Promise<number> {
  const { db, config } = deps
  const refUsuario = db.collection('assistenteUso').doc(`u_${uid}_${dia}`)
  const refGlobal = db.collection('assistenteUso').doc(`g_${dia}`)
  return db.runTransaction(async (tx) => {
    const [u, g] = await Promise.all([tx.get(refUsuario), tx.get(refGlobal)])
    const feitas = (u.get('perguntas') as number | undefined) ?? 0
    if (feitas >= config.perguntasPorUsuarioDia) {
      throw new ErroAssistente(
        'cota-usuario',
        `Você já fez as ${config.perguntasPorUsuarioDia} perguntas permitidas por dia. A cota volta amanhã.`,
        429,
      )
    }
    if (
      ((g.get('custoUsd') as number | undefined) ?? 0) >=
      config.orcamentoDiarioUsd
    ) {
      throw new ErroAssistente(
        'orcamento',
        'O assistente atingiu o limite de uso de hoje. Tente novamente amanhã ou fale com um administrador.',
        429,
      )
    }
    tx.set(
      refUsuario,
      { tipo: 'usuario', uid, dia, perguntas: FieldValue.increment(1) },
      { merge: true },
    )
    tx.set(
      refGlobal,
      { tipo: 'global', dia, perguntas: FieldValue.increment(1) },
      { merge: true },
    )
    return config.perguntasPorUsuarioDia - feitas - 1
  })
}

async function registrarGasto(
  deps: DepsAssistente,
  uid: string,
  dia: string,
  gasto: { custoUsd: number; entrada: number; saida: number },
  devolverPergunta: boolean,
) {
  const { db } = deps
  const soma = {
    custoUsd: FieldValue.increment(gasto.custoUsd),
    tokensEntrada: FieldValue.increment(gasto.entrada),
    tokensSaida: FieldValue.increment(gasto.saida),
    ...(devolverPergunta ? { perguntas: FieldValue.increment(-1) } : {}),
  }
  await Promise.all([
    db
      .collection('assistenteUso')
      .doc(`u_${uid}_${dia}`)
      .set(soma, { merge: true }),
    db.collection('assistenteUso').doc(`g_${dia}`).set(soma, { merge: true }),
  ])
}

const limitar = (texto: string, n: number) =>
  texto.length > n ? texto.slice(0, n) : texto

/**
 * Responde a uma pergunta com base só na documentação publicada a que o
 * usuário tem acesso. Passos: confere o perfil e a cota; a IA reformula a
 * pergunta em consultas; o motor de busca acha candidatos; a IA escolhe os
 * artigos; a IA escreve a resposta citando-os. Nada é escrito nos artigos.
 */
export async function responder(
  deps: DepsAssistente,
  uid: string,
  pedido: PedidoAssistente,
): Promise<RespostaAssistente> {
  const { db, ia, config } = deps
  const inicio = (deps.agora ?? Date.now)()
  const dia = diaDe(inicio)

  const escopo = await escopoDoUsuario(db, uid)
  if (!escopo) {
    throw new ErroAssistente(
      'sem-perfil',
      'Sua conta não tem acesso ao assistente. Fale com um administrador.',
      403,
    )
  }
  const historico = pedido.historico
    .slice(-config.maxHistorico)
    .map((m) => ({ papel: m.papel, texto: limitar(m.texto, 1000) }))

  const restantesHoje = await reservarCota(deps, uid, dia)
  const usos: UsoIA[] = []
  let concluida = false

  try {
    const filtrado = await aplicarFiltros(db, escopo, pedido.filtros)
    const indice = await lerIndice(db, filtrado.produtos)

    let fontes: Awaited<ReturnType<typeof carregarFontes>> = []
    let resposta = SEM_RESULTADO
    let encontrou = false
    let citadas: FonteResposta[] = []

    if (indice.length > 0) {
      const plano = await ia.planejar(pedido.pergunta, historico)
      usos.push(plano.uso)
      const candidatos = selecionarCandidatos(
        indice,
        [pedido.pergunta, ...plano.consultas],
        {
          verTecnico: escopo.verTecnico,
          categoria: pedido.filtros.categoria,
          blocos: filtrado.blocos,
          limite: config.maxCandidatos,
        },
      )

      let ids = candidatos.map((c) => c.id).slice(0, config.maxFontes)
      if (candidatos.length > config.maxFontes) {
        const escolha = await ia.escolher(
          pedido.pergunta,
          candidatos.map((c) => ({
            id: c.id,
            titulo: c.titulo,
            resumo: c.resumo,
          })),
        )
        usos.push(escolha.uso)
        const validos = new Set(candidatos.map((c) => c.id))
        ids = escolha.ids
          .filter((id) => validos.has(id))
          .slice(0, config.maxFontes)
      }

      fontes = await carregarFontes(
        db,
        ids,
        escopo,
        config.maxCaracteresPorFonte,
      )
      if (fontes.length > 0) {
        const documentos: DocumentoParaResposta[] = fontes.map((f, i) => ({
          numero: i + 1,
          titulo: f.titulo,
          produto: f.produto,
          markdown: f.markdown,
        }))
        const r = await ia.responder(pedido.pergunta, historico, documentos)
        usos.push(r.uso)
        resposta = r.resposta.resposta.trim() || SEM_RESULTADO
        encontrou = r.resposta.encontrou

        // As citações precisam apontar para documentos que a IA de fato recebeu.
        const noTexto = [...resposta.matchAll(/\[(\d+)\]/g)].map((m) =>
          Number(m[1]),
        )
        const numeros = new Set(
          [...r.resposta.fontes, ...noTexto].filter(
            (n) => n >= 1 && n <= documentos.length,
          ),
        )
        if (numeros.size === 0 && encontrou) {
          // Respondeu sem citar: mostra os documentos consultados, para dar rastro.
          documentos.forEach((d) => numeros.add(d.numero))
        }
        citadas = [...numeros]
          .sort((a, b) => a - b)
          .map((n) => {
            const f = fontes[n - 1]!
            return { numero: n, id: f.id, titulo: f.titulo, produto: f.produto }
          })
      }
    }

    const gasto = somar(usos)
    await registrarGasto(deps, uid, dia, gasto, false)
    concluida = true
    const ms = (deps.agora ?? Date.now)() - inicio
    const log = await db.collection('assistenteLog').add({
      uid,
      dia,
      criadoEm: inicio,
      pergunta: limitar(pedido.pergunta, 500),
      encontrou,
      fontes: citadas.map((f) => f.id),
      filtros: pedido.filtros,
      modelo: config.modelo,
      tokensEntrada: gasto.entrada,
      tokensSaida: gasto.saida,
      custoUsd: gasto.custoUsd,
      ms,
      feedback: null,
    })
    return {
      logId: log.id,
      encontrou,
      resposta,
      fontes: citadas,
      restantesHoje,
    }
  } catch (e) {
    if (!concluida) {
      // A pergunta não foi respondida: devolve-a à cota e soma o que já foi gasto.
      await registrarGasto(
        deps,
        uid,
        dia,
        {
          custoUsd: usos.reduce((t, u) => t + custoEstimado(u), 0),
          entrada: somar(usos).entrada,
          saida: somar(usos).saida,
        },
        true,
      ).catch(() => undefined)
    }
    if (e instanceof ErroAssistente) throw e
    if (e instanceof ErroIA) {
      throw new ErroAssistente('ia-indisponivel', e.message, 502)
    }
    throw e
  }
}
