import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { JSONContent } from '@tiptap/react'
import { describe, expect, it, vi } from 'vitest'
import { ArticleContent } from '../ArticleContent'
import { RichEditor } from './RichEditor'

vi.mock('../../services/media', () => ({ uploadMedia: vi.fn() }))

// O jsdom não calcula posições na tela, que o ProseMirror pede ao rolar até o cursor.
Range.prototype.getClientRects = () =>
  ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: [][Symbol.iterator],
  }) as unknown as DOMRectList
Range.prototype.getBoundingClientRect = () => new DOMRect()
document.elementFromPoint = () => null

const doc = (...content: JSONContent[]): JSONContent => ({
  type: 'doc',
  content,
})

describe('RichEditor: tabela', () => {
  it('insere uma tabela 3×3 com cabeçalho e libera os botões de linha e coluna', async () => {
    const onChange = vi.fn()
    render(
      <RichEditor value={doc({ type: 'paragraph' })} onChange={onChange} />,
    )
    expect(screen.queryByRole('button', { name: '+ Linha' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Tabela' }))
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const novo = onChange.mock.calls.at(-1)![0] as JSONContent
    const json = JSON.stringify(novo)
    expect(json).toContain('"type":"table"')
    expect((json.match(/"type":"tableHeader"/g) ?? []).length).toBe(3)
    expect((json.match(/"type":"tableCell"/g) ?? []).length).toBe(6)

    expect(
      await screen.findByRole('button', { name: '+ Linha' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Excluir tabela' }),
    ).toBeInTheDocument()
  })

  it('o cursor dentro da tabela permite acrescentar uma linha', async () => {
    const onChange = vi.fn()
    render(
      <RichEditor value={doc({ type: 'paragraph' })} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tabela' }))
    fireEvent.click(await screen.findByRole('button', { name: '+ Linha' }))
    await waitFor(() => {
      const json = JSON.stringify(onChange.mock.calls.at(-1)![0])
      expect((json.match(/"type":"tableRow"/g) ?? []).length).toBe(4)
    })
  })
})

describe('ArticleContent: tabela', () => {
  it('mostra a tabela com cabeçalho e células', async () => {
    const cell = (tipo: string, texto: string): JSONContent => ({
      type: tipo,
      attrs: { colspan: 1, rowspan: 1, colwidth: null },
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: texto }] },
      ],
    })
    const { container } = render(
      <ArticleContent
        conteudo={doc({
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                cell('tableHeader', 'Tipo'),
                cell('tableHeader', 'Formato'),
              ],
            },
            {
              type: 'tableRow',
              content: [
                cell('tableCell', 'Contrato'),
                cell('tableCell', 'PDF'),
              ],
            },
          ],
        })}
      />,
    )
    await waitFor(() => expect(container.querySelector('table')).not.toBeNull())
    expect(container.querySelectorAll('th')).toHaveLength(2)
    expect(container.querySelectorAll('td')).toHaveLength(2)
    expect(container.querySelector('td')).toHaveTextContent('Contrato')
  })
})
