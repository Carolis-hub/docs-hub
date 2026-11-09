import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { lerPreferencias, salvarPreferencias } from '../services/preferencias'
import type { ConfigAside, PreferenciasUsuario } from '../types/preferencias'
import { chaveModoLegado } from '../utils/aside'
import {
  PREFERENCIAS_PADRAO,
  deModoLegado,
  normalizarPreferencias,
} from '../utils/preferencias'

interface Estado {
  preferencias: PreferenciasUsuario
  /** Já se sabe o valor da conta (ou a leitura falhou). */
  pronto: boolean
  erro: string | null
}

/** Uma cópia por pessoa, compartilhada por todas as telas (um acesso por sessão). */
const estados = new Map<string, Estado>()
const carregando = new Set<string>()
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((o) => o())

const chaveLocal = (uid: string) => `docshub.prefs.${uid}`

function lerLocal(uid: string): PreferenciasUsuario | null {
  try {
    const bruto = localStorage.getItem(chaveLocal(uid))
    if (bruto) return normalizarPreferencias(JSON.parse(bruto))
    // Quem já tinha escolhido o modo da aside neste navegador não perde a escolha.
    return deModoLegado(localStorage.getItem(chaveModoLegado(uid)))
  } catch {
    return null
  }
}

function gravarLocal(uid: string, p: PreferenciasUsuario) {
  try {
    localStorage.setItem(chaveLocal(uid), JSON.stringify(p))
  } catch {
    /* sem armazenamento local: vale só na conta */
  }
}

function estadoDe(uid: string): Estado {
  let e = estados.get(uid)
  if (!e) {
    e = {
      preferencias: lerLocal(uid) ?? PREFERENCIAS_PADRAO,
      pronto: false,
      erro: null,
    }
    estados.set(uid, e)
  }
  return e
}

function trocar(uid: string, mudanca: Partial<Estado>) {
  estados.set(uid, { ...estadoDe(uid), ...mudanca })
  avisar()
}

async function carregar(uid: string) {
  if (carregando.has(uid) || estadoDe(uid).pronto) return
  carregando.add(uid)
  try {
    const daConta = await lerPreferencias(uid)
    if (daConta) {
      gravarLocal(uid, daConta)
      trocar(uid, { preferencias: daConta, pronto: true })
    } else {
      trocar(uid, { pronto: true })
    }
  } catch {
    // Sem rede ou sem permissão: segue com o que há neste navegador.
    trocar(uid, { pronto: true })
  } finally {
    carregando.delete(uid)
  }
}

/** Só para os testes: esquece o que foi lido. */
export function limparPreferenciasEmMemoria() {
  estados.clear()
  carregando.clear()
}

/**
 * Configurações da pessoa (modelo `PreferenciasUsuario`), guardadas na conta.
 * Mudanças aparecem na hora em todas as telas e são gravadas em seguida.
 */
export function usePreferencias(uid: string | undefined) {
  const estado = useSyncExternalStore(
    (ouvir) => {
      ouvintes.add(ouvir)
      return () => ouvintes.delete(ouvir)
    },
    () => (uid ? estadoDe(uid) : SEM_USUARIO),
  )

  useEffect(() => {
    if (uid) void carregar(uid)
  }, [uid])

  const atualizarAside = useCallback(
    async (parcial: Partial<ConfigAside>) => {
      if (!uid) return
      const atual = estadoDe(uid).preferencias
      const novo: PreferenciasUsuario = {
        ...atual,
        aside: { ...atual.aside, ...parcial },
      }
      gravarLocal(uid, novo)
      trocar(uid, { preferencias: novo, erro: null })
      try {
        await salvarPreferencias(uid, novo)
      } catch {
        trocar(uid, {
          erro: 'Não foi possível salvar na sua conta agora. A escolha vale só neste navegador por enquanto.',
        })
      }
    },
    [uid],
  )

  return {
    preferencias: estado.preferencias,
    aside: estado.preferencias.aside,
    erro: estado.erro,
    atualizarAside,
  }
}

const SEM_USUARIO: Estado = {
  preferencias: PREFERENCIAS_PADRAO,
  pronto: true,
  erro: null,
}
