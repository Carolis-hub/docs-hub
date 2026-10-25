import {
  Download,
  FileText,
  Paperclip,
  Share2,
  Trash2,
  Image,
  KeyRound,
} from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { iconeDoArtigo } from './iconeDoArtigo'

describe('iconeDoArtigo', () => {
  it.each([
    ['Como adicionar anexos ao fluxo?', Paperclip],
    ['Como compartilhar anexos?', Share2],
    ['Como excluir anexos no fluxo?', Trash2],
    ['Como gerar miniaturas dos anexos?', Image],
    ['Como fazer login informando usuário e senha', KeyRound],
    ['Como posso instalar o SmartShare 4?', Download],
    ['Assunto sem palavra-chave', FileText],
  ])('%s', (titulo, icone) => {
    expect(iconeDoArtigo(titulo)).toBe(icone)
  })

  it('usa o ícone padrão informado quando nada casa', () => {
    expect(iconeDoArtigo('Zzz', Download)).toBe(Download)
  })
})
