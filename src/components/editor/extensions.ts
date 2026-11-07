import Image from '@tiptap/extension-image'
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from '@tiptap/extension-table'
import StarterKit from '@tiptap/starter-kit'

/** Estilos semânticos apenas: H1–H3, parágrafo, listas, links, código, tabela e imagem. */
export const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true },
  }),
  Image,
  // Tabela simples: sem largura de coluna ajustável, para o texto continuar fluido.
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
]
