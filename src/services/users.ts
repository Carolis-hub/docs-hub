import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore'
import type { AppUser, NewUserInput, UserPatch } from '../types/user'
import { registrarAuditoria } from './audit'
import { auth, db, getSecondaryAuth } from './firebase'
import { limparPermissoes } from '../utils/permissoes'

const users = collection(db, 'users')

/** Admin vê todos os produtos, então a lista de permitidos é descartada. */
export function normalizarPermissoes<T extends UserPatch>(dados: T): T {
  return dados.role === 'admin'
    ? {
        ...dados,
        produtosPermitidos: [],
        verTecnico: true,
        ...(dados.unidadesPermitidas ? { unidadesPermitidas: [] } : {}),
      }
    : dados
}

/** Confere a senha e a confirmação; devolve a mensagem do problema, ou `null`. */
export function conferirSenha(
  senha: string,
  confirmacao: string,
): string | null {
  if (senha.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (senha !== confirmacao) return 'A senha e a confirmação não são iguais.'
  return null
}

export async function getUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(users, uid))
  return snap.exists()
    ? { uid: snap.id, ...(snap.data() as Omit<AppUser, 'uid'>) }
    : null
}

export async function listUsers(): Promise<AppUser[]> {
  const snap = await getDocs(users)
  return snap.docs
    .map((d) => ({ uid: d.id, ...(d.data() as Omit<AppUser, 'uid'>) }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

/**
 * Cria a conta no Auth por uma segunda instância (não desloga o admin) e
 * grava o perfil em `users/{uid}` com a sessão do admin.
 */
export async function createUser(
  input: NewUserInput,
  adminUid: string,
): Promise<string> {
  if (!input.nome.trim()) throw new Error('Informe o nome.')
  if (input.senha.length < 6) {
    throw new Error('A senha precisa ter pelo menos 6 caracteres.')
  }
  const secondaryAuth = getSecondaryAuth()
  let uid: string
  try {
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      input.email.trim(),
      input.senha,
    )
    uid = cred.user.uid
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'auth/email-already-in-use') {
      throw new Error(
        'Já existe uma conta de login com este e-mail. Se o usuário foi excluído daqui, apague também a conta no console do Firebase (Authentication) antes de criar de novo.',
      )
    }
    if (code === 'auth/invalid-email') throw new Error('E-mail inválido.')
    throw new Error('Não foi possível criar a conta.')
  } finally {
    await signOut(secondaryAuth).catch(() => undefined)
  }

  const dados = normalizarPermissoes(input)
  const batch = writeBatch(db)
  batch.set(doc(users, uid), {
    nome: input.nome.trim(),
    email: input.email.trim(),
    role: dados.role,
    produtosPermitidos: dados.produtosPermitidos,
    verTecnico: dados.verTecnico,
    ...(dados.unidadesPermitidas
      ? { unidadesPermitidas: dados.unidadesPermitidas }
      : {}),
    permissoes: limparPermissoes(input.permissoes),
    ativo: true,
  })
  registrarAuditoria(batch, adminUid, 'usuario.criar', `users/${uid}`)
  await batch.commit()
  return uid
}

export async function updateUser(
  uid: string,
  patch: UserPatch,
  adminUid: string,
): Promise<void> {
  if (!patch.nome.trim()) throw new Error('Informe o nome.')
  const dados = normalizarPermissoes(patch)
  const batch = writeBatch(db)
  batch.update(doc(users, uid), {
    nome: patch.nome.trim(),
    role: dados.role,
    produtosPermitidos: dados.produtosPermitidos,
    verTecnico: dados.verTecnico,
    ...(dados.unidadesPermitidas
      ? { unidadesPermitidas: dados.unidadesPermitidas }
      : {}),
    ...(patch.permissoes
      ? { permissoes: limparPermissoes(patch.permissoes) }
      : {}),
  })
  registrarAuditoria(batch, adminUid, 'usuario.editar', `users/${uid}`)
  await batch.commit()
}

export async function setUserAtivo(
  uid: string,
  ativo: boolean,
  adminUid: string,
): Promise<void> {
  if (uid === adminUid && !ativo) {
    throw new Error('Você não pode desativar a própria conta.')
  }
  const batch = writeBatch(db)
  batch.update(doc(users, uid), { ativo })
  registrarAuditoria(
    batch,
    adminUid,
    ativo ? 'usuario.reativar' : 'usuario.desativar',
    `users/${uid}`,
  )
  await batch.commit()
}

/**
 * Exclui os perfis (`users/{uid}`). Sem perfil a pessoa não entra mais: as
 * regras negam tudo. A conta de login do Firebase Authentication não pode ser
 * apagada pelo navegador; fica sem uso até alguém removê-la no console.
 */
export async function deleteUsers(
  uids: string[],
  adminUid: string,
): Promise<void> {
  if (uids.length === 0) return
  if (uids.includes(adminUid)) {
    throw new Error('Você não pode excluir a própria conta.')
  }
  // Cada exclusão ocupa duas gravações (perfil e auditoria); o lote aceita 500.
  for (let i = 0; i < uids.length; i += 200) {
    const batch = writeBatch(db)
    for (const uid of uids.slice(i, i + 200)) {
      batch.delete(doc(users, uid))
      registrarAuditoria(batch, adminUid, 'usuario.excluir', `users/${uid}`)
    }
    await batch.commit()
  }
}

/** Troca a senha de quem está logado (o Firebase só deixa trocar a própria). */
export async function alterarPropriaSenha(senha: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Sessão expirada. Entre de novo.')
  try {
    await updatePassword(auth.currentUser, senha)
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'auth/requires-recent-login') {
      throw new Error(
        'Por segurança, saia, entre de novo e repita a troca de senha.',
      )
    }
    if (code === 'auth/weak-password') {
      throw new Error('A senha precisa ter pelo menos 6 caracteres.')
    }
    throw new Error('Não foi possível trocar a senha.')
  }
}

/** Manda para a pessoa o e-mail do Firebase com o link para criar outra senha. */
export async function enviarRedefinicaoDeSenha(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email)
  } catch {
    throw new Error('Não foi possível enviar o e-mail de redefinição.')
  }
}
