import { Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { Carregando } from '../../components/Carregando'
import { PageHeader } from '../../components/PageHeader'
import { UsuarioEditor } from '../../components/UsuarioEditor'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { listProducts } from '../../services/blocks'
import { listUsers, setUserAtivo } from '../../services/users'

/** Configuração de usuários: lista à esquerda; ao escolher um, as abas Geral e Permissões. */
export function UsersPage() {
  const { user } = useAuth()
  const adminUid = user?.uid ?? ''
  const { dados, erro, carregando, recarregar } = useAsync(async () => {
    const [usuarios, produtos] = await Promise.all([
      listUsers(),
      listProducts(),
    ])
    return { usuarios, produtos }
  }, [])
  // `null`: nada aberto; 'novo': criando; senão, o uid do usuário em edição.
  const [aberto, setAberto] = useState<'novo' | string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')

  const usuarios = (dados?.usuarios ?? []).filter((u) =>
    `${u.nome} ${u.email}`.toLowerCase().includes(filtro.trim().toLowerCase()),
  )
  const selecionado =
    aberto && aberto !== 'novo'
      ? dados?.usuarios.find((u) => u.uid === aberto)
      : undefined

  async function alternarAtivo(uid: string, ativo: boolean) {
    try {
      await setUserAtivo(uid, ativo, adminUid)
      setAviso(null)
      recarregar()
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível alterar.')
    }
  }

  return (
    <div>
      <PageHeader
        icone={Users}
        titulo="Configuração de usuários"
        subtitulo="Escolha uma pessoa para ver e editar os dados cadastrais e as permissões."
        acoes={
          <button
            type="button"
            onClick={() => setAberto('novo')}
            className="botao botao-primario"
          >
            <Plus className="size-4" aria-hidden />
            Novo usuário
          </button>
        }
      />
      {aviso && (
        <p role="alert" className="mb-4 text-sm text-perigo">
          {aviso}
        </p>
      )}
      {carregando && !dados && <Carregando />}
      {erro && (
        <p role="alert" className="text-perigo">
          {erro}
        </p>
      )}

      {dados && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <section aria-label="Usuários cadastrados" className="cartao p-3">
            <label className="sr-only" htmlFor="filtro-usuarios">
              Filtrar usuários
            </label>
            <input
              id="filtro-usuarios"
              type="search"
              className="campo mb-2"
              placeholder="Filtrar por nome ou e-mail…"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
            {usuarios.length === 0 ? (
              <p className="p-2 text-sm text-suave">
                Nenhum usuário encontrado.
              </p>
            ) : (
              <ul className="space-y-1">
                {usuarios.map((u) => (
                  <li key={u.uid}>
                    <button
                      type="button"
                      aria-current={aberto === u.uid ? 'true' : undefined}
                      onClick={() => setAberto(u.uid)}
                      className={`flex w-full flex-col rounded-xl px-3 py-2 text-left text-sm transition hover:bg-bloco/60 ${aberto === u.uid ? 'bg-bloco' : ''}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-semibold">{u.nome}</span>
                        <span className="selo">
                          {u.role === 'admin' ? 'Admin' : 'Leitor'}
                        </span>
                        {u.ativo === false && (
                          <span className="selo text-perigo">Desativado</span>
                        )}
                      </span>
                      <span className="text-suave">{u.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div>
            {aberto === 'novo' && (
              <UsuarioEditor
                key="novo"
                produtos={dados.produtos}
                adminUid={adminUid}
                onCancel={() => setAberto(null)}
                onDone={(uid) => {
                  setAberto(uid)
                  recarregar()
                }}
              />
            )}
            {selecionado && (
              <div className="space-y-3">
                <UsuarioEditor
                  key={selecionado.uid}
                  produtos={dados.produtos}
                  usuario={selecionado}
                  adminUid={adminUid}
                  onCancel={() => setAberto(null)}
                  onDone={() => recarregar()}
                />
                <button
                  type="button"
                  className="botao"
                  onClick={() =>
                    void alternarAtivo(
                      selecionado.uid,
                      selecionado.ativo === false,
                    )
                  }
                >
                  {selecionado.ativo === false
                    ? 'Reativar conta'
                    : 'Desativar conta'}
                </button>
              </div>
            )}
            {!aberto && (
              <p className="cartao p-5 text-sm text-suave">
                Selecione um usuário na lista para ver e editar as suas
                configurações.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
