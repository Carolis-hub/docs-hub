import Image from '@tiptap/extension-image'
import StarterKit from '@tiptap/starter-kit'

/** Estilos semânticos apenas: H1–H3, parágrafo, listas, links, código e imagem. */
export const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true },
  }),
  Image,
]
