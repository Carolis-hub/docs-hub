import { useRef, useState } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import { uploadMedia } from '../../services/media'
import { extensions } from './extensions'

interface Props {
  value: JSONContent
  onChange: (doc: JSONContent) => void
}

const botao =
  'rounded px-2 py-1 text-sm font-medium transition hover:bg-bloco  disabled:opacity-40'

export function RichEditor({ value, onChange }: Props) {
  const inputArquivo = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const editor = useEditor({
    extensions,
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
  })

  if (!editor) return null

  const ativo = (nome: string, attrs?: Record<string, unknown>) =>
    editor.isActive(nome, attrs) ? `${botao} bg-bloco ` : botao

  function pedirAlt(atual = ''): string | null {
    const alt = window.prompt(
      'Texto alternativo da imagem (obrigatório, descreva o que ela mostra):',
      atual,
    )
    if (alt === null) return null
    if (!alt.trim()) {
      setErro('O texto alternativo é obrigatório.')
      return null
    }
    setErro(null)
    return alt.trim()
  }

  async function aoEscolherArquivo(file: File | undefined) {
    if (!file || !editor) return
    setErro(null)
    const alt = pedirAlt()
    if (!alt) return
    setEnviando(true)
    try {
      const { url } = await uploadMedia(file)
      editor.chain().focus().setImage({ src: url, alt }).run()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha no upload.')
    } finally {
      setEnviando(false)
      if (inputArquivo.current) inputArquivo.current.value = ''
    }
  }

  function editarAlt() {
    if (!editor?.isActive('image')) return
    const atual = (editor.getAttributes('image').alt as string) ?? ''
    const alt = pedirAlt(atual)
    if (alt) editor.chain().focus().updateAttributes('image', { alt }).run()
  }

  function definirLink() {
    const atual = (editor?.getAttributes('link').href as string) ?? ''
    const url = window.prompt('Endereço do link (vazio remove):', atual)
    if (url === null) return
    if (url.trim() === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor
        ?.chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url.trim() })
        .run()
    }
  }

  const chain = () => editor.chain().focus()

  return (
    <div className="rounded-md border border-borda bg-cartao ">
      <div
        role="toolbar"
        aria-label="Formatação"
        className="flex flex-wrap items-center gap-1 border-b border-borda p-2 "
      >
        <button
          type="button"
          className={ativo('paragraph')}
          onClick={() => chain().setParagraph().run()}
        >
          Parágrafo
        </button>
        {([1, 2, 3] as const).map((level) => (
          <button
            key={level}
            type="button"
            className={ativo('heading', { level })}
            onClick={() => chain().toggleHeading({ level }).run()}
          >
            Título {level}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-borda " />
        <button
          type="button"
          className={ativo('bold')}
          onClick={() => chain().toggleBold().run()}
        >
          Negrito
        </button>
        <button
          type="button"
          className={ativo('italic')}
          onClick={() => chain().toggleItalic().run()}
        >
          Itálico
        </button>
        <button
          type="button"
          className={ativo('code')}
          onClick={() => chain().toggleCode().run()}
        >
          Código
        </button>
        <button
          type="button"
          className={ativo('codeBlock')}
          onClick={() => chain().toggleCodeBlock().run()}
        >
          Bloco de código
        </button>
        <span className="mx-1 h-5 w-px bg-borda " />
        <button
          type="button"
          className={ativo('bulletList')}
          onClick={() => chain().toggleBulletList().run()}
        >
          Lista
        </button>
        <button
          type="button"
          className={ativo('orderedList')}
          onClick={() => chain().toggleOrderedList().run()}
        >
          Lista numerada
        </button>
        <button type="button" className={ativo('link')} onClick={definirLink}>
          Link
        </button>
        <span className="mx-1 h-5 w-px bg-borda " />
        <button
          type="button"
          className={botao}
          disabled={enviando}
          onClick={() => inputArquivo.current?.click()}
        >
          {enviando ? 'Enviando…' : 'Imagem / GIF'}
        </button>
        <button
          type="button"
          className={botao}
          disabled={!editor.isActive('image')}
          onClick={editarAlt}
        >
          Editar texto alternativo
        </button>
        <input
          ref={inputArquivo}
          type="file"
          accept="image/png,image/jpeg,image/gif"
          className="hidden"
          aria-label="Selecionar imagem"
          onChange={(e) => void aoEscolherArquivo(e.target.files?.[0])}
        />
      </div>
      {erro && (
        <p role="alert" className="px-3 pt-2 text-sm text-perigo ">
          {erro}
        </p>
      )}
      <div className="doc-content p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
