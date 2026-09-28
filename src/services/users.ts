import { getApps, initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db, firebaseConfig, usandoEmulator } from './firebase'
import { registrarAuditLog } from './auditLog'
import type { AppUser, UserInput } from '../types/user'

const usersCollection = collection(db, 'users')

const SECONDARY_APP_NAME = 'docs-hub-admin-actions'

function getSecondaryAuth() {
  const appSecundario =
    getApps().find((app) => app.name === SECONDARY_APP_NAME) ??
    initializeApp(firebaseConfig, SECONDARY_APP_NAME)

  const authSecundario = getAuth(appSecundario)

  if (usandoEmulator && !authSecundario.emulatorConfig) {
    connectAuthEmulator(authSecundario, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    })
  }

  return authSecundario
}

function toAppUser(uid: string, data: Record<string, unknown>): AppUser {
  return {
    uid,
    nome: data.nome as string,
    email: data.email as string,
    role: data.role as AppUser['role'],
    produtosPermitidos: (data.produtosPermitidos as string[]) ?? [],
    verTecnico: (data.verTecnico as boolean) ?? false,
    ativo: (data.ativo as boolean) ?? true,
  }
}

export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const snapshot = await getDoc(doc(usersCollection, uid))
  if (!snapshot.exists()) return null
  return toAppUser(snapshot.id, snapshot.data())
}

export async function listUsers(): Promise<AppUser[]> {
  const q = query(usersCollection, orderBy('nome'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => toAppUser(docSnap.id, docSnap.data()))
}

/**
 * Cria o usuário no Firebase Auth através de uma instância secundária, para
 * não substituir a sessão do admin logado, e grava o perfil no Firestore
 * usando a instância principal (autenticada como o admin).
 */
export async function createUser(
  input: UserInput,
  email: string,
  senha: string,
  criadoPor: string,
): Promise<string> {
  const authSecundario = getSecondaryAuth()
  const credencial = await createUserWithEmailAndPassword(
    authSecundario,
    email,
    senha,
  )
  const uid = credencial.user.uid
  await signOut(authSecundario)

  await setDoc(doc(usersCollection, uid), {
    nome: input.nome,
    email,
    role: input.role,
    produtosPermitidos: input.produtosPermitidos,
    verTecnico: input.verTecnico,
    ativo: true,
  })

  await registrarAuditLog(criadoPor, 'criar_usuario', uid)

  return uid
}

export async function updateUser(
  uid: string,
  input: Partial<UserInput>,
  editadoPor: string,
): Promise<void> {
  await updateDoc(doc(usersCollection, uid), { ...input })
  await registrarAuditLog(editadoPor, 'editar_usuario', uid)
}

export async function setUserAtivo(
  uid: string,
  ativo: boolean,
  autorId: string,
): Promise<void> {
  await updateDoc(doc(usersCollection, uid), { ativo })
  await registrarAuditLog(
    autorId,
    ativo ? 'reativar_usuario' : 'desativar_usuario',
    uid,
  )
}
