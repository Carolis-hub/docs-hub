import type { AppUser } from '../types/user'

/** Uma funcionalidade cujo acesso pode ser liberado ou bloqueado por usuário. */
export interface Funcionalidade {
  id: string
  rotulo: string
  descricao: string
  /** Rota protegida por ela (telas de administração). */
  rota?: string
  /** Só quem tem o papel Admin pode usar; para leitor fica sempre bloqueada. */
  soAdmin?: boolean
}

export interface ModuloDePermissao {
  id: string
  titulo: string
  descricao: string
  itens: Funcionalidade[]
}

export const MODULOS_DE_PERMISSAO: ModuloDePermissao[] = [
  {
    id: 'navegacao',
    titulo: 'Navegação lateral (Aside)',
    descricao: 'Controla se a entrada aparece na aside e se a tela abre.',
    itens: [
      {
        id: 'manual',
        rotulo: 'Manual de produtos',
        descricao: 'Home, produtos, subprodutos, módulos, artigos e a busca.',
      },
      {
        id: 'busca',
        rotulo: 'Busca/consulta com IA',
        descricao: 'Página do assistente e o botão flutuante do assistente.',
      },
    ],
  },
  {
    id: 'administracao',
    titulo: 'Administração',
    descricao: 'Telas de Configurações › Administração.',
    itens: [
      {
        id: 'usuarios',
        rotulo: 'Configuração de usuários',
        descricao: 'Criar, editar e desativar contas e permissões.',
        rota: '/admin/usuarios',
        soAdmin: true,
      },
      {
        id: 'usoIA',
        rotulo: 'Uso da IA',
        descricao: 'Perguntas, custo e limites do assistente.',
        rota: '/admin/assistente',
        soAdmin: true,
      },
      {
        id: 'metricas',
        rotulo: 'Métricas',
        descricao: 'Painel de acessos e buscas.',
        rota: '/admin/metricas',
        soAdmin: true,
      },
    ],
  },
  {
    id: 'governanca',
    titulo: 'Governança',
    descricao: 'Telas de Configurações › Governança.',
    itens: [
      {
        id: 'revisao',
        rotulo: 'Revisão',
        descricao: 'Fila de aprovação de artigos.',
        rota: '/admin/revisao',
        soAdmin: true,
      },
      {
        id: 'sincronizacao',
        rotulo: 'Sincronização',
        descricao: 'Pastas de documentos que chegam ao sistema.',
        rota: '/admin/sincronizacao',
        soAdmin: true,
      },
      {
        id: 'auditoria',
        rotulo: 'Auditoria',
        descricao: 'Registro de quem fez o quê e quando.',
        rota: '/admin/auditoria',
        soAdmin: true,
      },
    ],
  },
]

export const FUNCIONALIDADES: Funcionalidade[] = MODULOS_DE_PERMISSAO.flatMap(
  (m) => m.itens,
)

/** Pode usar a funcionalidade? Sem perfil, nunca; o que não foi gravado vale como liberado. */
export function podeAcessar(
  perfil: Pick<AppUser, 'role' | 'permissoes'> | null | undefined,
  id: string,
): boolean {
  if (!perfil) return false
  const f = FUNCIONALIDADES.find((x) => x.id === id)
  if (f?.soAdmin && perfil.role !== 'admin') return false
  return perfil.permissoes?.[id] !== false
}

/** Mapa completo (todas as funcionalidades) a partir do que está gravado. */
export function permissoesCompletas(
  gravadas: Record<string, boolean> | undefined,
): Record<string, boolean> {
  return Object.fromEntries(
    FUNCIONALIDADES.map((f) => [f.id, gravadas?.[f.id] !== false]),
  )
}

/** Descarta ids desconhecidos e valores que não são booleanos antes de gravar. */
export function limparPermissoes(
  entrada: Record<string, unknown> | undefined,
): Record<string, boolean> {
  return Object.fromEntries(
    FUNCIONALIDADES.map((f) => [f.id, entrada?.[f.id] !== false]),
  )
}

/** Primeira tela que a pessoa pode abrir (para onde mandar quem não tem acesso à Home). */
export function primeiraRotaPermitida(
  perfil: Pick<AppUser, 'role' | 'permissoes'> | null | undefined,
): string | null {
  if (podeAcessar(perfil, 'manual')) return '/'
  if (podeAcessar(perfil, 'busca')) return '/assistente'
  return null
}

/** Permissão exigida por uma rota de administração, se houver. */
export function permissaoDaRota(caminho: string): string | undefined {
  return FUNCIONALIDADES.find(
    (f) => f.rota && (caminho === f.rota || caminho.startsWith(`${f.rota}/`)),
  )?.id
}
