import { useState, type FormEvent } from 'react'
import { createUser, updateUser } from '../services/users'
import type { Block } from '../types/content'
import type { AppUser, UserRole } from '../types/user'
import { MODULOS_DE_PERMISSAO, permissoesCompletas } from '../utils/permissoes'

type Aba = 'geral' | 'permissoes'

interface Props {
  produtos: Block[]
  /** Sem `usuario`, cria uma conta nova. */
  usuario?: AppUser
  adminUid: string
  onDone: (uid: string) => void
  onCancel: () => void
}

/**
 * Edição de um usuário em duas abas: **Geral** (dados cadastrais) e
 * **Permissões** (acesso por módulo e funcionalidade). As duas abas gravam
 * juntas no botão Salvar.
 */
export function UsuarioEditor({
  produtos,
  usuario,
  adminUid,
  onDone,
  onCancel,
}: Props) {
  const editando = !!usuario
  const [aba, setAba] = useState<Aba>('geral')
  const [nome, setNome] = useState(usuario?.nome ?? '')
  const [email, setEmail] = useState(usuario?.email ?? '')
  const [senha, setSenha] = useState('')
  const [role, setRole] = useState<UserRole>(usuario?.role ?? 'reader')
  const [permitidos, setPermitidos] = useState<string[]>(
    usuario?.produtosPermitidos ?? [],
  )
  const [verTecnico, setVerTecnico] = useState(usuario?.verTecnico ?? false)
  const [permissoes, setPermissoes] = useState(() =>
    permissoesCompletas(usuario?.permissoes),
  )
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const admin = role === 'admin'
  const propriaConta = usuario?.uid === adminUid

  const alternarProduto = (id: string) =>
    setPermitidos((atual) =>
      atual.includes(id) ? atual.filter((p) => p !== id) : [...atual, id],
    )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      if (usuario) {
        await updateUser(
          usuario.uid,
          {
            nome,
            role,
            produtosPermitidos: permitidos,
            verTecnico,
            permissoes,
          },
          adminUid,
        )
        onDone(usuario.uid)
      } else {
        const uid = await createUser(
          {
            nome,
            email,
            senha,
            role,
            produtosPermitidos: permitidos,
            verTecnico,
            permissoes,
          },
          adminUid,
        )
        onDone(uid)
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'geral', rotulo: 'Geral' },
    { id: 'permissoes', rotulo: 'Permissões' },
  ]

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      aria-label={editando ? 'Editar usuário' : 'Novo usuário'}
      className="cartao p-5"
    >
      <h2 className="text-lg font-bold">
        {editando ? usuario.nome : 'Novo usuário'}
      </h2>
      {editando && <p className="text-sm text-suave">{usuario.email}</p>}

      <div
        role="tablist"
        aria-label="Seções do usuário"
        className="mt-4 flex gap-1 border-b border-borda"
      >
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            id={`aba-${a.id}`}
            aria-selected={aba === a.id}
            aria-controls={`painel-${a.id}`}
            onClick={() => setAba(a.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition ${aba === a.id ? 'border-destaque font-semibold text-texto' : 'border-transparent font-medium text-suave hover:text-texto'}`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="painel-geral"
        aria-labelledby="aba-geral"
        hidden={aba !== 'geral'}
        className="mt-4 space-y-3"
      >
        <label className="block text-sm">
          Nome
          <input
            className="campo mt-1"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          E-mail
          <input
            type="email"
            className="campo mt-1"
            value={email}
            disabled={editando}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {!editando && (
          <label className="block text-sm">
            Senha inicial
            <input
              type="password"
              autoComplete="new-password"
              className="campo mt-1"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </label>
        )}
        <label className="block text-sm">
          Papel
          <select
            className="campo mt-1"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="reader">Leitor</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        {editando && usuario.ativo === false && (
          <p className="text-sm text-perigo">Conta desativada.</p>
        )}
      </div>

      <div
        role="tabpanel"
        id="painel-permissoes"
        aria-labelledby="aba-permissoes"
        hidden={aba !== 'permissoes'}
        className="mt-4 space-y-6"
      >
        <section aria-labelledby="perm-conteudo">
          <h3 id="perm-conteudo" className="text-sm font-bold">
            Conteúdo
          </h3>
          {admin ? (
            <p className="mt-1 text-sm text-suave">
              Admins veem todos os produtos e o conteúdo técnico.
            </p>
          ) : (
            <div className="mt-2 space-y-2 text-sm">
              <fieldset>
                <legend className="mb-1 text-suave">Produtos permitidos</legend>
                {produtos.length === 0 && (
                  <p className="text-suave">Nenhum produto cadastrado.</p>
                )}
                {produtos.map((p) => (
                  <label
                    key={p.id}
                    className="mr-4 inline-flex items-center gap-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={permitidos.includes(p.id)}
                      onChange={() => alternarProduto(p.id)}
                    />
                    {p.nome}
                  </label>
                ))}
              </fieldset>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={verTecnico}
                  onChange={(e) => setVerTecnico(e.target.checked)}
                />
                Pode ver artigos técnicos
              </label>
            </div>
          )}
        </section>

        {MODULOS_DE_PERMISSAO.map((m) => (
          <section key={m.id} aria-labelledby={`perm-${m.id}`}>
            <h3 id={`perm-${m.id}`} className="text-sm font-bold">
              {m.titulo}
            </h3>
            <p className="text-xs text-suave">{m.descricao}</p>
            <ul className="mt-2 divide-y divide-borda rounded-xl border border-borda">
              {m.itens.map((f) => {
                const bloqueadoPeloPapel = !!f.soAdmin && !admin
                const trancada = propriaConta && f.id === 'usuarios'
                return (
                  <li key={f.id}>
                    <label
                      className={`flex items-start gap-3 px-3 py-2.5 text-sm ${bloqueadoPeloPapel ? 'opacity-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        disabled={bloqueadoPeloPapel || trancada}
                        checked={
                          !bloqueadoPeloPapel && permissoes[f.id] === true
                        }
                        onChange={(e) =>
                          setPermissoes((atual) => ({
                            ...atual,
                            [f.id]: e.target.checked,
                          }))
                        }
                      />
                      <span>
                        <span className="block font-medium">{f.rotulo}</span>
                        <span className="block text-suave">
                          {f.descricao}
                          {bloqueadoPeloPapel && ' Exige o papel Admin.'}
                          {trancada &&
                            ' Não dá para tirar o seu próprio acesso aqui.'}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      {erro && (
        <p role="alert" className="mt-4 text-sm text-perigo">
          {erro}
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
