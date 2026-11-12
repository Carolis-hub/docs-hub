# padronizar — artigos no padrão de manual de usuário

Confere os artigos de um produto com o **padrão de manual** em
[`docs/padrao-de-manual.md`](../../docs/padrao-de-manual.md) e, se você pedir,
usa a IA para propor a reescrita. A IA **nunca publica nem altera o artigo**:
cada proposta vira uma **sugestão** (`articles/{id}/suggestions`), que um admin
compara lado a lado na tela **Sugestões**.

Serve para o que acabou de entrar pela ingestão ou pelo `migrate`: texto
"puro" da base antiga, com parágrafos enormes, definições soltas, estados em
caixa alta, pré-requisito no fim e figuras citadas por posição.

```
artigos em revisão ─► conferência local (grátis) ─► IA reescreve no padrão ─► sugestão pendente
                          lista os problemas          (só com --ia)             admin aprova ou edita
```

## Passo a passo

1. **Só conferir** (sem custo, sem chave de IA). Mostra, por artigo, o que foge do padrão, os piores primeiro:
   ```
   npm run padronizar -- --projeto docs-hub-dev-16c1f --produto "SmartShare 4"
   ```
2. **Testar a IA em um artigo**, sem gravar (gasta cota; precisa de `ANTHROPIC_API_KEY`):
   ```
   npm run padronizar -- --projeto docs-hub-dev-16c1f --produto "SmartShare 4" --artigo <id> --ia
   ```
   Veja as mudanças (`+`) e os avisos (`!`) que ela devolve.
3. **Gravar as sugestões** (repita com `--gravar`):
   ```
   npm run padronizar -- --projeto docs-hub-dev-16c1f --produto "SmartShare 4" --ia --gravar --limite 10
   ```
4. No docs-hub, abra **Sugestões**. Artigo **em revisão**: use "Editar antes de aprovar" (a sugestão entra no rascunho). Artigo **publicado**: "Aprovar e publicar" funciona.

Rodar de novo é seguro: a mesma versão do artigo com o mesmo padrão não gera sugestão repetida. Se você mudar o padrão ou o artigo mudar, gera uma nova.

## O que a conferência local aponta

Parágrafo com mais de 600 caracteres, texto longo sem seções, definições em
parágrafos soltos (`**Termo:** …`), imagem sem texto alternativo útil, figura
citada por posição ("figura abaixo"), "Como…" sem passos numerados, estados em
CAIXA ALTA e pré-requisito (módulo, licença, permissão) só no fim. Código em
`src/utils/padraoManual.ts`. Não é um juiz: artigo sem problemas aqui ainda
pode melhorar.

## O que a IA faz e o que não faz

- Reorganiza e reescreve **só a forma**, no padrão. Preserva fatos, números, nomes da interface e links.
- **Não inventa.** Quando falta informação para cumprir o padrão (passos de um procedimento, caminho de menu), escreve `[Confirmar: …]` no texto e lista a dúvida.
- **Não mexe nas imagens.** Textos alternativos fracos: use `npm run alt-texto`.
- Se o artigo já está no padrão, não gera sugestão.

Para ajudar o revisor, a sugestão traz **avisos** automáticos: imagens que
mudaram, números do original que sumiram, trechos `[Confirmar: …]` e dúvidas da IA.

## Opções

`--produto` (obrigatório; id, nome ou slug), `--bloco <ref>` (só um
subproduto/módulo e o que está abaixo), `--artigo <id>` (repetível; ignora
`--status` e `--bloco`), `--status` (padrão `review`; também `draft`,
`approved`, `published`, `rejected`, `archived`, separados por vírgula),
`--limite` (padrão 10 por execução), `--min-problemas` (padrão 1), `--ia`,
`--gravar` (só com `--ia`), `--padrao <arquivo>`, `--projeto`, `--modelo`
(ou `PADRONIZAR_MODEL`), `--ajuda`.

## Limites conhecidos

- A IA lê o artigo em Markdown: tabelas e formatações raras do editor podem simplificar-se. Por isso a sugestão sempre passa por uma pessoa.
- Artigos muito grandes podem estourar o limite de resposta da IA: o script avisa e segue para o próximo.
- Não foi exercitado com a API da Anthropic de verdade (os testes usam um provedor falso, contra o Emulator): rode o passo 2 em um artigo antes de gravar em lote.
