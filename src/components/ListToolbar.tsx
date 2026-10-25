import {
  ArrowDownAZ,
  ArrowUpAZ,
  LayoutGrid,
  List,
  ListFilter,
} from 'lucide-react'

export function TituloDeSecao({
  titulo,
  total,
}: {
  titulo: string
  total: number
}) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold">
      {titulo}
      <span className="selo" aria-label={`${total} itens`}>
        {total}
      </span>
    </h2>
  )
}

export function FiltroDaLista({
  valor,
  aoMudar,
  placeholder,
}: {
  valor: string
  aoMudar: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <ListFilter
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-suave"
        aria-hidden
      />
      <input
        type="search"
        aria-label={placeholder.replace('…', '')}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="campo h-9 w-52 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
    </div>
  )
}

export function BotaoOrdenar({
  crescente,
  aoAlternar,
}: {
  crescente: boolean
  aoAlternar: () => void
}) {
  const Icone = crescente ? ArrowDownAZ : ArrowUpAZ
  return (
    <button
      type="button"
      onClick={aoAlternar}
      className="botao h-9"
      title={
        crescente
          ? 'Ordem alfabética (clique para inverter)'
          : 'Ordem alfabética invertida'
      }
    >
      <Icone className="size-4" aria-hidden />
      {crescente ? 'A–Z' : 'Z–A'}
    </button>
  )
}

export type Visao = 'lista' | 'grade'

export function AlternarVisao({
  visao,
  aoMudar,
}: {
  visao: Visao
  aoMudar: (v: Visao) => void
}) {
  const item = (v: Visao, rotulo: string, Icone: typeof List) => (
    <button
      type="button"
      aria-label={rotulo}
      aria-pressed={visao === v}
      title={rotulo}
      onClick={() => aoMudar(v)}
      className={`inline-flex size-8 items-center justify-center rounded-md transition ${
        visao === v ? 'bg-bloco text-texto' : 'text-suave hover:text-texto'
      }`}
    >
      <Icone className="size-4" aria-hidden />
    </button>
  )
  return (
    <div
      role="group"
      aria-label="Modo de exibição"
      className="flex rounded-lg border border-borda bg-cartao p-0.5"
    >
      {item('lista', 'Ver em lista', List)}
      {item('grade', 'Ver em grade', LayoutGrid)}
    </div>
  )
}

/** Interruptor com rótulo (ex.: "Organizar"). */
export function Interruptor({
  ligado,
  aoMudar,
  rotulo,
}: {
  ligado: boolean
  aoMudar: (v: boolean) => void
  rotulo: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={() => aoMudar(!ligado)}
      className="botao h-9 gap-2.5"
    >
      <span
        aria-hidden
        className={`relative inline-flex h-4 w-7 items-center rounded-full transition ${ligado ? 'bg-destaque' : 'bg-borda'}`}
      >
        <span
          className={`absolute size-3 rounded-full bg-cartao transition-all ${ligado ? 'left-[14px]' : 'left-0.5'}`}
        />
      </span>
      {rotulo}
    </button>
  )
}
