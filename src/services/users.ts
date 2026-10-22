import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore'
import type { AppUser, NewUserInput, UserPatch } from '../types/user'
import { registrarAuditoria } from './audit'
import { db, getSecondaryAuth } from './firebase'

const users = collection(db, 'users')

/** Admin vê todos os produtos, então a lista de permitidos é descartada. */
export function normalizarPermissoes<T extends UserPatch>(dados: T): T {
  return dados.role === 'admin'
    ? { ...dados, produtosPermitidos: [], verTecnico: true }
    : dados
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
      throw new Error('Já existe uma conta com este e-mail.')
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
