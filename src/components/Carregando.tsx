/**
 * Indicador de carregamento no centro da tela, com o fundo desfocado. Fica
 * por cima de tudo enquanto os dados da tela chegam.
 */
export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-fundo/60 backdrop-blur-md"
    >
      <span
        aria-hidden
        className="size-12 rounded-full border-4 border-borda border-t-destaque motion-safe:animate-spin"
      />
      <p className="text-sm font-semibold text-texto">{texto}</p>
    </div>
  )
}
