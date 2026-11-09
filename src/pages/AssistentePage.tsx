import { Bot } from 'lucide-react'
import { AssistenteChat } from '../components/AssistenteChat'
import { PageHeader } from '../components/PageHeader'

export function AssistentePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icone={Bot}
        titulo="Assistente"
        subtitulo="Pergunte em linguagem natural. As respostas usam só a documentação publicada que você pode ler, e citam as fontes."
      />
      <AssistenteChat />
    </div>
  )
}
