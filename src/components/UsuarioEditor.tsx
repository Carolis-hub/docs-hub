import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  alterarPropriaSenha,
  conferirSenha,
  createUser,
  enviarRedefinicaoDeSenha,
  setUserAtivo,
  updateUser,
} from '../services/users'
import type { Block, Unidade } from '../types/content'
import type { AppUser, UserRole } from '../types/user'
import {
  SEM_UNIDADE,
  produtosDasUnidades,
  unidadesIniciais,
} from '../utils/acessoPorUnidade'
import { MODULOS_DE_PERMISSAO, permissoesCompletas } from '../utils/permissoes'
import { ENTRADAS_DA_ASIDE } from '../utils/preferencias'
import { agruparPorUnidade } from '../utils/unidades'

interface Props {
  produtos: Block[]
  unidades: Unidade[]
  /** Sem `usuario`, cria uma conta nova. */
  usuario?: AppUser
  adminUid: string
  onDone: (uid: string) => void
  onCancel: () => void
}

/** Telas de administração: só fazem sentido para quem é Administrador. */
const TELAS_DE_ADMIN = MODULOS_DE_PERMISSAO.flatMap((m) => m.itens).filter(
  (f) => f.soAdmin,
)

/**
 * Criação e edição de um usuário, em dois módulos: **Geral** (dados da conta)
 * e **Permissões** (aside lateral e BUs). Os dois gravam juntos no Salvar.
 */
export function UsuarioEditor({
  produtos,
  unidades,
  usuario,
  adminUid,
  onDone,
  onCancel,
}: Props) {
  const editando = !!usuario
  const propriaConta = usuario?.uid === adminUid
  const idsDasUnidades = unidades.map((u) => u.id)

  const [nome, setNome] = useState(usuario?.nome ?? '')
  const [email, setEmail] = useState(usuario?.email ?? '')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [role, setRole] = useState<UserRole>(usuario?.role ?? 'reader')
  const [ativo, setAtivo] = useState(usuario?.ativo !== false)
  const [liberadas, setLiberadas] = useState<string[]>(() =>
    unidadesIniciais(usuario, produtos, idsDasUnidades),
  )
  const [verTecnico, setVerTecnico] = useState(usuario?.verTecnico ?? false)
  const [permissoes, setPermissoes] = useState(() =>
    permissoesCompletas(usuario?.permissoes),
  )
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const admin = role === 'admin'
  // Todas as BUs aparecem (mesmo vazias); "sem BU" só se houver produto solto.
  const grupos = agruparPorUnidade(produtos, unidades, true).map((g) => ({
    chave: g.chave,
    nome: g.unidade ? g.unidade.nome : 'Produtos sem BU',
    produtos: g.produtos.length,
  }))
  const marcadas = grupos.filter((g) => liberadas.includes(g.chave)).length
  const todas = grupos.length > 0 && marcadas === grupos.length
  const caixaTodas = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (caixaTodas.current) {
      caixaTodas.current.indeterminate = marcadas > 0 && !todas
    }
  }, [marcadas, todas])

  const alternarUnidade = (chave: string) =>
    setLiberadas((atual) =>
      atual.includes(chave)
        ? atual.filter((c) => c !== chave)
        : [...atual, chave],
    )
  const marcarPermissao = (id: string, valor: boolean) =>
    setPermissoes((atual) => ({ ...atual, [id]: valor }))

  async function redefinirSenha() {
    if (!usuario) return
    setErro(null)
    setAviso(null)
    try {
      await enviarRedefinicaoDeSenha(usuario.email)
      setAviso(`E-mail de redefinição de senha enviado para ${usuario.email}.`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar.')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setAviso(null)
    // Na edição a senha é opcional: em branco, fica como está.
    const trocarSenha = !editando || senha !== '' || confirmacao !== ''
    if (trocarSenha) {
      const problema = conferirSenha(senha, confirmacao)
      if (problema) return setErro(problema)
    }
    // Só as BUs que ainda existem são gravadas.
    const unidadesPermitidas = liberadas.filter((c) =>
      grupos.some((g) => g.chave === c),
    )
    const dados = {
      nome,
      role,
      unidadesPermitidas,
      produtosPermitidos: produtosDasUnidades(
        unidadesPermitidas,
        produtos,
        idsDasUnidades,
      ),
      verTecnico,
      permissoes,
    }
    setSalvando(true)
    try {
      if (!usuario) {
        onDone(await createUser({ ...dados, email, senha }, adminUid))
        return
      }
      await updateUser(usuario.uid, dados, adminUid)
      if (ativo !== (usuario.ativo !== false)) {
        await setUserAtivo(usuario.uid, ativo, adminUid)
      }
      if (trocarSenha) {
        try {
          await alterarPropriaSenha(senha)
        } catch (err) {
          const motivo = err instanceof Error ? err.message : ''
          throw new Error(
            `Os dados foram salvos, mas a senha não foi trocada. ${motivo}`,
          )
        }
      }
      onDone(usuario.uid)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      aria-label={editando ? 'Editar usuário' : 'Novo usuário'}
    >
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby="modulo-geral" className="cartao p-5">
          <h2 id="modulo-geral" className="text-lg font-bold">
            Geral
          </h2>
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              Nome
              <input
                className="campo mt-1"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              E-mail (usado para entrar)
              <input
                type="email"
                className="campo mt-1"
                value={email}
                disabled={editando}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {!editando || propriaConta ? (
              <>
                <label className="block text-sm">
                  {editando ? 'Nova senha' : 'Senha'}
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="campo mt-1"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  {editando ? 'Confirmar nova senha' : 'Confirmar senha'}
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="campo mt-1"
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                  />
                </label>
                {editando && (
                  <p className="text-xs text-suave">
                    Deixe em branco para manter a senha atual.
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-borda p-3 text-sm">
                <p className="font-medium">Senha</p>
                <p className="mt-1 text-suave">
                  Só a própria pessoa pode trocar a senha dela. Envie o e-mail
                  de redefinição para que ela escolha uma nova.
                </p>
                <button
                  type="button"
                  className="botao mt-2"
                  onClick={() => void redefinirSenha()}
                >
                  Enviar e-mail de redefinição de senha
                </button>
              </div>
            )}
            <label className="block text-sm">
              Tipo de usuário
              <select
                className="campo mt-1"
                value={role}
                disabled={propriaConta}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="reader">Leitor</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            {propriaConta && (
              <p className="text-xs text-suave">
                Não dá para mudar o tipo da sua própria conta.
              </p>
            )}
            {editando && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ativo}
                  disabled={propriaConta}
                  onChange={(e) => setAtivo(e.target.checked)}
                />
                Conta ativa (desmarque para impedir o acesso sem excluir)
              </label>
            )}
          </div>
        </section>

        <section aria-labelledby="modulo-permissoes" className="cartao p-5">
          <h2 id="modulo-permissoes" className="text-lg font-bold">
            Permissões
          </h2>

          <fieldset className="mt-4 space-y-2">
            <legend className="text-sm font-bold">Aside lateral</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={permissoes.aside === true}
                onChange={(e) => marcarPermissao('aside', e.target.checked)}
              />
              Mostrar a aside
            </label>
            <div
              role="group"
              aria-label="Entradas da aside"
              className="space-y-2 border-l-2 border-borda pl-4"
            >
              {ENTRADAS_DA_ASIDE.map((entrada) => (
                <label
                  key={entrada.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={permissoes[entrada.id] === true}
                    onChange={(e) =>
                      marcarPermissao(entrada.id, e.target.checked)
                    }
                  />
                  {entrada.rotulo}
                </label>
              ))}
            </div>
            <p className="text-xs text-suave">
              Desmarcar uma entrada tira o item da aside e bloqueia a tela dela.
              Desmarcar "Mostrar a aside" só esconde o menu lateral.
            </p>
          </fieldset>

          <fieldset className="mt-6 space-y-2">
            <legend className="text-sm font-bold">BUs</legend>
            {admin ? (
              <p className="text-sm text-suave">
                Administradores veem todas as BUs e o conteúdo técnico.
              </p>
            ) : grupos.length === 0 ? (
              <p className="text-sm text-suave">Nenhuma BU cadastrada.</p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    ref={caixaTodas}
                    type="checkbox"
                    checked={todas}
                    onChange={(e) =>
                      setLiberadas(
                        e.target.checked ? grupos.map((g) => g.chave) : [],
                      )
                    }
                  />
                  Selecionar todos
                </label>
                <div
                  role="group"
                  aria-label="BUs liberadas"
                  className="space-y-2 border-l-2 border-borda pl-4"
                >
                  {grupos.map((g) => (
                    <label
                      key={g.chave}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={liberadas.includes(g.chave)}
                        onChange={() => alternarUnidade(g.chave)}
                      />
                      <span
                        className={
                          g.chave === SEM_UNIDADE ? 'italic' : 'uppercase'
                        }
                      >
                        {g.nome}
                      </span>
                      <span className="text-xs text-suave">
                        {g.produtos === 1
                          ? '1 produto'
                          : `${g.produtos} produtos`}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-suave">
                  A pessoa vê todos os produtos das BUs marcadas, inclusive os
                  que entrarem nelas depois.
                </p>
                <label className="flex items-center gap-2 pt-2 text-sm">
                  <input
                    type="checkbox"
                    checked={verTecnico}
                    onChange={(e) => setVerTecnico(e.target.checked)}
                  />
                  Pode ver artigos técnicos
                </label>
              </>
            )}
          </fieldset>

          {admin && (
            <fieldset className="mt-6 space-y-2">
              <legend className="text-sm font-bold">
                Telas de administração
              </legend>
              {TELAS_DE_ADMIN.map((f) => {
                const trancada = propriaConta && f.id === 'usuarios'
                return (
                  <label key={f.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      disabled={trancada}
                      checked={permissoes[f.id] === true}
                      onChange={(e) => marcarPermissao(f.id, e.target.checked)}
                    />
                    <span>
                      <span className="block">{f.rotulo}</span>
                      <span className="block text-xs text-suave">
                        {f.descricao}
                        {trancada &&
                          ' Não dá para tirar o seu próprio acesso aqui.'}
                      </span>
                    </span>
                  </label>
                )
              })}
            </fieldset>
          )}
        </section>
      </div>

      {erro && (
        <p role="alert" className="mt-4 text-sm text-perigo">
          {erro}
        </p>
      )}
      {aviso && (
        <p role="status" className="mt-4 text-sm text-suave">
          {aviso}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="botao botao-primario"
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={onCancel} className="botao">
          Cancelar
        </button>
      </div>
    </form>
  )
}
