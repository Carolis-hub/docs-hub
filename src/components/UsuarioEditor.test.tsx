import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Block, Unidade } from '../types/content'
import type { AppUser } from '../types/user'

const updateUser = vi.fn(async (..._a: unknown[]) => undefined)
const createUser = vi.fn(async (..._a: unknown[]) => 'novo-uid')
const setUserAtivo = vi.fn(async (..._a: unknown[]) => undefined)
const alterarPropriaSenha = vi.fn(async (..._a: unknown[]) => undefined)
const enviarRedefinicaoDeSenha = vi.fn(async (..._a: unknown[]) => undefined)
vi.mock('../services/users', () => ({
  updateUser: (...a: unknown[]) => updateUser(...a),
  createUser: (...a: unknown[]) => createUser(...a),
  setUserAtivo: (...a: unknown[]) => setUserAtivo(...a),
  alterarPropriaSenha: (...a: unknown[]) => alterarPropriaSenha(...a),
  enviarRedefinicaoDeSenha: (...a: unknown[]) => enviarRedefinicaoDeSenha(...a),
  conferirSenha: (senha: string, confirmacao: string) =>
    senha.length < 6
      ? 'A senha precisa ter pelo menos 6 caracteres.'
      : senha !== confirmacao
        ? 'A senha e a confirmação não são iguais.'
        : null,
}))

const { UsuarioEditor } = await import('./UsuarioEditor')

const leitor: AppUser = {
  uid: 'u1',
  nome: 'Ana',
  email: 'ana@x.com',
  role: 'reader',
  produtosPermitidos: [],
  verTecnico: false,
}
const unidades = [
  { id: 'ps', nome: 'Process Solution', ordem: 0 },
  { id: 'fin', nome: 'Financeiro', ordem: 1 },
] as Unidade[]
const produtos = [
  { id: 'ss4', nome: 'SmartShare 4', unidadeId: 'ps' },
  { id: 'di', nome: 'SmartShare DI', unidadeId: 'ps' },
  { id: 'erp', nome: 'ERP', unidadeId: 'fin' },
] as Block[]

function abrir(usuario?: AppUser, adminUid = 'a') {
  const onDone = vi.fn()
  render(
    <UsuarioEditor
      produtos={produtos}
      unidades={unidades}
      usuario={usuario}
      adminUid={adminUid}
      onDone={onDone}
      onCancel={vi.fn()}
    />,
  )
  return onDone
}

beforeEach(() => vi.clearAllMocks())

describe('UsuarioEditor', () => {
  it('tem os módulos Geral e Permissões na mesma tela', () => {
    abrir(leitor)
    expect(screen.getByRole('heading', { name: 'Geral' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Permissões' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nome')).toHaveValue('Ana')
    expect(screen.getByLabelText('Tipo de usuário')).toHaveValue('reader')
    expect(screen.getByLabelText('Mostrar a aside')).toBeChecked()
    expect(screen.getByLabelText('Manual de produtos')).toBeChecked()
    expect(screen.getByLabelText('Busca/consulta com IA')).toBeChecked()
    expect(screen.getByLabelText(/Process Solution/)).not.toBeChecked()
  })

  it('criar exige senha e confirmação iguais', async () => {
    const onDone = abrir()
    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Bia' },
    })
    fireEvent.change(screen.getByLabelText(/E-mail/), {
      target: { value: 'bia@x.com' },
    })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'segredo1' },
    })
    fireEvent.change(screen.getByLabelText('Confirmar senha'), {
      target: { value: 'segredo2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('não são iguais')
    expect(createUser).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Confirmar senha'), {
      target: { value: 'segredo1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('novo-uid'))
    expect(createUser.mock.calls[0]?.[0]).toMatchObject({
      nome: 'Bia',
      email: 'bia@x.com',
      senha: 'segredo1',
      role: 'reader',
    })
  })

  it('"Selecionar todos" marca todas as BUs e grava os produtos delas', async () => {
    const onDone = abrir(leitor)
    fireEvent.click(screen.getByLabelText('Selecionar todos'))
    expect(screen.getByLabelText(/Process Solution/)).toBeChecked()
    expect(screen.getByLabelText(/Financeiro/)).toBeChecked()
    fireEvent.click(screen.getByLabelText(/Financeiro/))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('u1'))
    expect(updateUser.mock.calls[0]?.[1]).toMatchObject({
      unidadesPermitidas: ['ps'],
      produtosPermitidos: ['di', 'ss4'],
    })
  })

  it('salva as permissões da aside junto com os dados', async () => {
    const onDone = abrir(leitor)
    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Ana Maria' },
    })
    fireEvent.click(screen.getByLabelText('Busca/consulta com IA'))
    fireEvent.click(screen.getByLabelText('Mostrar a aside'))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('u1'))
    const patch = updateUser.mock.calls[0]?.[1] as {
      nome: string
      permissoes: Record<string, boolean>
    }
    expect(patch.nome).toBe('Ana Maria')
    expect(patch.permissoes).toMatchObject({
      aside: false,
      busca: false,
      manual: true,
    })
    // Senha em branco na edição: nada é trocado.
    expect(alterarPropriaSenha).not.toHaveBeenCalled()
  })

  it('senha de outra pessoa: só o e-mail de redefinição', async () => {
    abrir(leitor)
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: /redefinição de senha/i }),
    )
    await waitFor(() =>
      expect(enviarRedefinicaoDeSenha).toHaveBeenCalledWith('ana@x.com'),
    )
  })

  it('na própria conta troca a senha, mas não o tipo nem o acesso a usuários', async () => {
    const onDone = abrir({ ...leitor, uid: 'a', role: 'admin' }, 'a')
    expect(screen.getByLabelText('Tipo de usuário')).toBeDisabled()
    expect(screen.getByLabelText(/Configuração de usuários/)).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'outra123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'outra123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(alterarPropriaSenha).toHaveBeenCalledWith('outra123')
  })

  it('administrador vê todas as BUs; as telas de administração só aparecem para ele', () => {
    abrir(leitor)
    expect(screen.queryByLabelText(/Auditoria/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tipo de usuário'), {
      target: { value: 'admin' },
    })
    expect(screen.queryByLabelText('Selecionar todos')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Auditoria/)).toBeChecked()
  })

  it('desmarcar "Conta ativa" desativa a conta ao salvar', async () => {
    const onDone = abrir(leitor)
    fireEvent.click(screen.getByLabelText(/Conta ativa/))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(setUserAtivo).toHaveBeenCalledWith('u1', false, 'a')
  })
})
