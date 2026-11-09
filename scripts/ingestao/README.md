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

## Sincronização contínua

Há três jeitos de manter a pasta em dia com o docs-hub. Em todos, nada é
publicado sozinho (veja a tabela abaixo) e o resultado aparece na tela
**Sincronização** do docs-hub.

- **Manual:** rode o comando quando quiser.
- **Vigiando a pasta** (`--observar`, com `--gravar`): o comando fica aberto e
  confere a pasta a cada 2 minutos (`--a-cada <min>`); só quando algo mudou ele
  sincroniza. Parar: `Ctrl+C`. A conferência é local (nome, tamanho e data dos
  arquivos), então deixar rodando **não gasta a cota** do Firebase. Se uma
  rodada falhar (rede), a mesma mudança é tentada de novo na volta seguinte.
  ```
  npm run ingestao -- "C:\projetos_selbetti\smartshare-di\docs" --projeto docs-hub-dev-16c1f --produto "SmartShare DI" --sem-imagens --gravar --observar
  ```
- **Git (a cada push):** o workflow reutilizável `ingestao.yml` roda a
  ingestão no repositório dos documentos a cada push e grava o repositório e o
  commit (passos em "Configuração dos workflows" do `README.md` da raiz). Se a
  pasta for um checkout do Git, o commit também é descoberto sozinho no modo
  manual e no `--observar`; `--repo` e `--commit` forçam os valores.

Atenção: o `ingestao.yml` ainda não foi exercitado de verdade (depende de
segredos e de um repositório de documentos); o comando local é testado contra o
Emulator.

## Painel de sincronização

A tela **Sincronização** (menu admin) mostra, por fonte: se está **em dia**,
**desatualizada** (mais de 7 dias sem conferir) ou **com erros**; produto, modo,
quando foi conferida, quando houve a última mudança, o commit; as contagens da
última rodada; os arquivos que deram erro (com o motivo) e os que sumiram da
origem. Cada rodada grava um resumo em `sincronizacoes/{fonte}` (uma leitura por
fonte para abrir o painel). A tela só mostra: para reprocessar, rode o comando
de novo, na máquina que tem a pasta.

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

`--produto` (obrigatório; id, nome ou slug), `--bloco <ref>` (subproduto que
recebe os arquivos; id, nome ou slug), `--fonte <nome>` (padrão: produto + nome da pasta; é o que
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
