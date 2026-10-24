# alt-texto

Sugere **textos alternativos** (alt) melhores para as imagens dos artigos. O
editor exige alt em toda imagem; ao importar uma base sem alts (como a do
SmartShare, em que nenhuma imagem tem), o importador gera um texto genérico
("Imagem 2 do artigo …"). Esta ferramenta troca esses textos por descrições
úteis, para quem usa leitor de tela.

```
artigos com alt fraco ──► IA vê a imagem + o texto ao redor ──► sugestão pendente
                                                                      │
                                                    admin: revisar e aprovar em "Sugestões"
```

Nada é alterado direto: o resultado é uma **sugestão** em
`articles/{id}/suggestions`, revisada na mesma tela do `doc-sync`. Aprovar
publica uma nova versão do artigo, com o histórico de versões de sempre.

## Uso

```bash
export ANTHROPIC_API_KEY=…
export GOOGLE_APPLICATION_CREDENTIALS=service-account-dev.json

# Simulação em um artigo: roda a IA e mostra o antes e o depois, sem gravar
npm run alt-texto -- --projeto docs-hub-dev --artigo m-22304

# Cria a sugestão
npm run alt-texto -- --projeto docs-hub-dev --artigo m-22304 --gravar

# Todos os artigos publicados com alt fraco (comece com --limite)
npm run alt-texto -- --projeto docs-hub-dev --todos --limite 5 --gravar
```

Requer Node 22.18 ou mais novo. Opções: `--revisar-todas` (reescreve também os
alts que parecem bons), `--sem-imagem` (só o texto, sem a imagem: mais barato e
bem pior), `--modelo <id>` (padrão `claude-opus-5-5`, ou `ALT_TEXTO_MODEL`).
Para testar contra o Emulator, defina `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`.

## O que conta como alt fraco

Alt vazio ou o genérico do importador (`Imagem N do artigo "…"`). Alts escritos
à mão ficam como estão, a não ser com `--revisar-todas`.

## O que a IA recebe e devolve

- **Recebe:** o título do artigo e, para cada imagem, a seção, o texto antes e
  depois, o alt atual e a **própria imagem** (por endereço público, como os do
  Cloudinary). Em GIFs animados a IA vê só o primeiro quadro e usa o texto ao
  redor para dizer a ação demonstrada.
- **Devolve:** o alt, uma confiança (alta, média, baixa) e se a imagem parece
  decorativa (ícone, separador).
- **Regras do prompt:** frase curta (até 200 caracteres), em português, sem
  "Imagem de…", sem repetir o parágrafo ao redor, sem inventar o que não se vê.

## Para o revisor

Cada mudança aparece na lista "O que mudou" da tela de revisão, e a ferramenta
escreve **avisos** onde vale olhar com mais atenção:

- confiança média ou baixa;
- imagem que a IA não conseguiu abrir (o alt veio só do texto ao redor);
- imagem que parece decorativa (considere removê-la do artigo);
- imagem para a qual a IA não devolveu texto (o alt continua o antigo).

Como as duas colunas da tela mostram a mesma coisa (só o alt muda), a tela
avisa isso em uma faixa e a revisão se faz pela lista.

## Limites

- A IA não vê o que não está na imagem: alts de telas muito detalhadas ou com
  texto pequeno merecem conferência.
- Se uma imagem não é pública, o pedido cai para "só texto" naquela imagem.
- Cada execução custa chamadas à API da Anthropic, proporcionais ao número de
  imagens. Use `--limite` e a simulação antes de rodar em tudo.
- Rodar de novo no mesmo artigo não duplica a sugestão (o `id` vem das imagens
  e dos alts atuais); depois que uma sugestão é aprovada, os alts deixam de ser
  fracos e o artigo sai da fila.
