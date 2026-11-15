import { ArrowLeft, UserCog, UserPlus } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Carregando } from '../../components/Carregando'
import { PageHeader } from '../../components/PageHeader'
import { UsuarioEditor } from '../../components/UsuarioEditor'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { listProducts } from '../../services/blocks'
import { listUnidades } from '../../services/unidades'
import { getUser } from '../../services/users'

const VOLTAR = '/admin/configuracoes'

/** Tela própria para criar (sem `uid` na rota) ou editar um usuário. */
export function UsuarioPage() {
  const { uid } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { dados, erro, carregando } = useAsync(async () => {
    const [usuario, produtos, unidades] = await Promise.all([
      uid ? getUser(uid) : null,
      listProducts(),
      listUnidades(),
    ])
    return { usuario, produtos, unidades }
  }, [uid])

  const naoEncontrado = !!uid && !!dados && !dados.usuario
  return (
    <div>
      <Link
        to={VOLTAR}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-suave hover:text-texto"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Configurações
      </Link>
      <PageHeader
        icone={uid ? UserCog : UserPlus}
        titulo={uid ? 'Editar usuário' : 'Novo usuário'}
        subtitulo={dados?.usuario?.email}
      />
      {carregando && !dados && <Carregando />}
      {erro && (
        <p role="alert" className="text-perigo">
          {erro}
        </p>
      )}
      {naoEncontrado && (
        <p role="alert" className="text-suave">
          Usuário não encontrado. Ele pode ter sido excluído.
        </p>
      )}
      {dados && !naoEncontrado && (
        <UsuarioEditor
          key={uid ?? 'novo'}
          produtos={dados.produtos}
          unidades={dados.unidades}
          usuario={dados.usuario ?? undefined}
          adminUid={user?.uid ?? ''}
          onCancel={() => navigate(VOLTAR)}
          onDone={() => navigate(VOLTAR)}
        />
      )}
    </div>
  )
}
