import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ArticleEditor } from './ArticleEditor'
import type { JSONContent } from '@tiptap/react'

const conteudoVazio: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

describe('ArticleEditor', () => {
  it('renderiza a barra de ferramentas quando editável', async () => {
    render(<ArticleEditor conteudo={conteudoVazio} onChange={vi.fn()} />)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Título 1' }),
      ).toBeInTheDocument(),
    )
  })

  it('não renderiza a barra de ferramentas em modo leitura', async () => {
    render(
      <ArticleEditor
        conteudo={conteudoVazio}
        onChange={vi.fn()}
        editavel={false}
      />,
    )
    await waitFor(() =>
      expect(document.querySelector('.ProseMirror')).toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('button', { name: 'Título 1' }),
    ).not.toBeInTheDocument()
  })
})
