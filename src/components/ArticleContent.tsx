import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import { extensions } from './editor/extensions'

/** Renderização somente leitura do conteúdo TipTap. */
export function ArticleContent({ conteudo }: { conteudo: JSONContent }) {
  const editor = useEditor({ extensions, content: conteudo, editable: false }, [
    conteudo,
  ])
  return (
    <div className="doc-content">
      <EditorContent editor={editor} />
    </div>
  )
}
