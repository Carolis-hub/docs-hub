import type { Config } from 'tailwindcss'

/** Cores do protótipo, definidas como variáveis em `src/index.css` (claro e escuro). */
const cor = (nome: string) => `rgb(var(--${nome}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        fundo: cor('fundo'),
        cartao: cor('cartao'),
        borda: cor('borda'),
        texto: cor('texto'),
        suave: cor('suave'),
        destaque: cor('destaque'),
        bloco: cor('bloco'),
        'bloco-icone': cor('bloco-icone'),
        ambar: cor('ambar'),
        'ambar-fundo': cor('ambar-fundo'),
        pasta: cor('pasta'),
        'pasta-fundo': cor('pasta-fundo'),
        perigo: cor('perigo'),
        sucesso: cor('sucesso'),
      },
    },
  },
  plugins: [],
} satisfies Config
