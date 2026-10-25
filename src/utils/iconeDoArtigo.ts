import {
  Bell,
  ClipboardList,
  Download,
  FileStack,
  FileText,
  Flag,
  History,
  Image,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Paperclip,
  Search,
  Settings,
  Share2,
  Trash2,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { normalizar } from './search'

/** Ordem importa: o primeiro padrão que casar com o título decide o ícone. */
const REGRAS: Array<[RegExp, LucideIcon]> = [
  [/compartilh/, Share2],
  [/exclu|apag|remov/, Trash2],
  [/miniatur|thumbnail|imagem/, Image],
  [/anex/, Paperclip],
  [/histor|versoes|versao/, History],
  [/template/, FileStack],
  [/comentario/, MessageSquare],
  [/alerta|notifica|\btags?\b/, Bell],
  [/prioridade/, Flag],
  [/formulario/, ClipboardList],
  [/login|senha|acesso|autentic|\bsso\b|duplo fator/, KeyRound],
  [/dashboard|visao geral|indicador|eficiencia/, LayoutDashboard],
  [/tarefa|executa|executar/, ListChecks],
  [/fluxo|processo|subprocesso/, Workflow],
  [/instal|requisito|baixar/, Download],
  [/idioma|preferenc|configur/, Settings],
  [/encontrar|buscar|filtr/, Search],
]

/** Ícone do artigo, escolhido pelas palavras do título. */
export function iconeDoArtigo(
  titulo: string,
  padrao: LucideIcon = FileText,
): LucideIcon {
  const t = normalizar(titulo)
  return REGRAS.find(([regra]) => regra.test(t))?.[1] ?? padrao
}
