# ingestao — documentos de uma pasta para o docs-hub

Lê os documentos de uma pasta (por exemplo `C:\projetos_selbetti\smartshare-di\docs`)
e os leva para o docs-hub **sempre pela fila de revisão**: nada é publicado
sozinho. Pode ser rodada quantas vezes quiser: ela só refaz o que mudou.

```
npm run ingestao -- "C:\projetos_selbetti\smartshare-di\docs" --projeto docs-hub-dev-16c1f --produto "SmartShare DI" --sem-imagens
```

Sem `--gravar` é **simulação**: lê, converte, classifica e mostra o que faria,
sem escrever nada. Repita com `--gravar` para aplicar. O relatório fica em
`.ingestao\relatorio-ingestao.md` (pasta ignorada pelo git).

## Formatos

`.md`, `.html` e `.txt`. `.docx` e `.pdf` ainda **não** são lidos: aparecem no
relatório como "ignorados". Pastas dentro da origem viram subprodutos (blocos)
dentro do produto escolhido.

## O que acontece com cada arquivo

| Situação na pasta                          | O que a ingestão faz                                                                                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arquivo novo                               | Cria o artigo **em revisão**, com categoria e público sugeridos                                                                                          |
| Arquivo alterado, artigo ainda na fila     | Atualiza o item da fila (se ninguém o editou)                                                                                                            |
| Arquivo alterado, artigo publicado/editado | Cria uma **sugestão pendente** (tela "Sugestões"); a versão publicada continua no ar até você aprovar. Uma sugestão antiga do mesmo arquivo é descartada |
| Arquivo removido                           | Marca o artigo com "origem removida"; ele aparece na tela **Revisão** para você despublicar ou manter. Nada é despublicado sozinho                       |
| Mesmo conteúdo em outro arquivo            | Não cria o artigo duas vezes (compara o hash do conteúdo)                                                                                                |
| Arquivo sem alterações                     | Não é reprocessado                                                                                                                                       |
| Erro ao ler ou converter                   | Fica registrado como erro; rodar de novo tenta outra vez                                                                                                 |

O que cada arquivo já gerou fica na coleção `fontes` do Firestore (hash, estado,
erro) e em `origem` do artigo (fonte, arquivo, hash).

## Classificação automática

Por **regras simples** (palavras no título, no caminho e no texto; blocos de
código e termos técnicos), **sem IA**. Sugere a categoria (Funcionalidades,
Configurações, Processos, Regras de negócio) e se o conteúdo é funcional,
técnico ou misto. Técnico e misto entram como público "Técnico" (visível só a
quem pode ver conteúdo técnico). Erra: a tela **Revisão** avisa que é sugestão,
e o editor permite trocar antes de aprovar.

## Opções

`--produto` (obrigatório; id, nome ou slug), `--bloco <id>` (subproduto que
recebe os arquivos), `--fonte <nome>` (padrão: produto + nome da pasta; é o que
liga os arquivos aos registros, então não mude depois), `--projeto`, `--gravar`,
`--sem-imagens`, `--verificar-links`, `--rest`, `--autor`, `--saida`,
`--estrito`, `--ajuda`.

Imagens: com `--gravar` e sem `--sem-imagens`, as imagens locais vão ao
Cloudinary (mesmas variáveis do importador). Credenciais do Firestore:
`GOOGLE_APPLICATION_CREDENTIALS`.

## Limites conhecidos

- Rodar é manual; o monitoramento contínuo de pasta entra na Fase 6.
- Mudar só imagens (sem mudar o texto) não é detectado: o hash é do arquivo de texto.
- Se alguém **excluir** um artigo no docs-hub, a ingestão não o recria enquanto o
  arquivo não mudar.
