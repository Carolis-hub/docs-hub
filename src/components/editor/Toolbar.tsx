import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { ImageDialog } from './ImageDialog'

interface ToolbarButtonProps {
  ativo?: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}

function ToolbarButton({
  ativo,
  onClick,
  label,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={ativo}
      title={label}
      className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
        ativo
          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

export function Toolbar({ editor }: { editor: Editor }) {
  const [mostrarDialogoImagem, setMostrarDialogoImagem] = useState(false)

  function inserirLink() {
    const urlAtual = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL do link', urlAtual ?? 'https://')
    if (url === null) return

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
      <ToolbarButton
        label="Título 1"
        ativo={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        label="Título 2"
        ativo={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        label="Título 3"
        ativo={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>
      <ToolbarButton
        label="Parágrafo"
        ativo={editor.isActive('paragraph')}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        P
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" />

      <ToolbarButton
        label="Lista com marcadores"
        ativo={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        • Lista
      </ToolbarButton>
      <ToolbarButton
        label="Lista numerada"
        ativo={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. Lista
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" />

      <ToolbarButton
        label="Link"
        ativo={editor.isActive('link')}
        onClick={inserirLink}
      >
        Link
      </ToolbarButton>
      <ToolbarButton
        label="Código em linha"
        ativo={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        Código
      </ToolbarButton>
      <ToolbarButton
        label="Bloco de código"
        ativo={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        {'</>'}
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" />

      <ToolbarButton
        label="Imagem ou GIF"
        onClick={() => setMostrarDialogoImagem(true)}
      >
        Imagem
      </ToolbarButton>

      {mostrarDialogoImagem && (
        <ImageDialog
          onClose={() => setMostrarDialogoImagem(false)}
          onConfirm={(url, alt) => {
            editor.chain().focus().setImage({ src: url, alt }).run()
            setMostrarDialogoImagem(false)
          }}
        />
      )}
    </div>
  )
}
