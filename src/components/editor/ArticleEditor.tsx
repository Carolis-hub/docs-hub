import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { useEffect } from 'react'
import { Toolbar } from './Toolbar'

interface ArticleEditorProps {
  conteudo: JSONContent
  onChange: (conteudo: JSONContent) => void
  editavel?: boolean
}

const extensoes = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true },
  }),
  Image.configure({ inline: false }),
]

export function ArticleEditor({
  conteudo,
  onChange,
  editavel = true,
}: ArticleEditorProps) {
  const editor = useEditor({
    extensions: extensoes,
    content: conteudo,
    editable: editavel,
    onUpdate: ({ editor: editorAtual }) => {
      onChange(editorAtual.getJSON())
    },
  })

  useEffect(() => {
    return () => editor?.destroy()
  }, [editor])

  if (!editor) return null

  return (
    <div className="overflow-hidden rounded-md border border-slate-300 dark:border-slate-600">
      {editavel && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="prose prose-slate max-w-none px-4 py-3 focus:outline-none dark:prose-invert [&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:focus:outline-none"
      />
    </div>
  )
}

export function ArticleViewer({ conteudo }: { conteudo: JSONContent }) {
  const editor = useEditor({
    extensions: extensoes,
    content: conteudo,
    editable: false,
  })

  useEffect(() => {
    return () => editor?.destroy()
  }, [editor])

  if (!editor) return null

  return (
    <EditorContent
      editor={editor}
      className="prose prose-slate max-w-none dark:prose-invert"
    />
  )
}
