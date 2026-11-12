# docs-hub

Plataforma interna da Selbetti para hospedar a documentação dos produtos
(produtos → subprodutos → artigos), com busca, métricas, sugestões de
atualização por IA e migração da base atual (`docs.selbetti.com.br`).
Interface e documentação em **português do Brasil**.

## Onde ler primeiro

- `PLAN.md`: decisões de arquitetura, modelo de dados, regras de segurança e
  as fases (0 a 7, todas implementadas em código).
- `docs/arquitetura.md`: arquitetura tecnológica (camadas, dados, IA, automação, riscos).
- `docs/estudo-consulta-kb.md`: estudo da consulta à KB por produto (busca, IA,
  embeddings), com recomendação, MVP e fases.
- `docs/roadmap.md`: o que falta e o que vem a seguir. **Atualize ao terminar
  uma tarefa** (marque o item e faça commit).
- `README.md`: como rodar, checklist de configuração dos workflows do GitHub.
- `scripts/<pasta>/README.md`: cada ferramenta (migrate, doc-sync, alt-texto,
  backup, cloudinary-limpeza, verificar-links, estrutura, ingestao, assistente,
  busca)
  tem o seu.

## Comandos

| Comando                                                 | Para quê                                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run dev`                                           | Sistema em `http://localhost:5173`                                                                 |
| `npm test`                                              | Testes unitários (Vitest)                                                                          |
| `npm run test:rules`                                    | Regras do Firestore e scripts contra o Emulator (precisa de Java)                                  |
| `npm run lint` / `typecheck` / `format:check` / `build` | Conferências que o CI também roda                                                                  |
| `npm run migrate -- <pasta> …`                          | Importador (simulação por padrão; `--gravar` grava; entra em revisão, `--publicar` publica direto) |
| `npm run ingestao -- <pasta> --produto …`               | Leva os `.md`/`.html`/`.txt` de uma pasta para a fila de revisão (simulação por padrão)            |
| `npm run ingestao -- … --observar --gravar`             | Fica vigiando a pasta e sincroniza quando algo muda (não gasta cota enquanto nada muda)            |
| `npm run estrutura -- …`                                | Cria uma BU e liga produtos já importados a ela                                                    |
| `npm run assistente -- --projeto …`                     | Servidor do assistente de IA (precisa de `ANTHROPIC_API_KEY`)                                      |
| `npm run assistente-avaliar -- --casos …`               | Mede a qualidade do assistente com perguntas suas (gasta com a IA; sem `--executar` só confere)    |
| `npm run busca-avaliar -- --casos … --projeto …`        | Mede a taxa de acerto da busca com consultas suas (sem IA, sem gasto)                              |
| `npm run alt-texto -- …`                                | Sugere textos alternativos de imagens (IA)                                                         |
| `npm run doc-sync -- …`                                 | Sugere atualizações de artigos a partir de `.md` de regras                                         |

Antes de abrir PR: `lint`, `typecheck`, `test`, `build`, `format:check` e
`test:rules` devem passar. Há 2 avisos de lint antigos (`useAuth`, `useTheme`).

## Como o código é organizado

- `src/` é o app (React 18 + TypeScript + Vite + Tailwind + Firebase no
  navegador). Páginas em `src/pages`, serviços do Firestore em `src/services`,
  funções puras em `src/utils` (testáveis e **reutilizadas pelos scripts**).
- `scripts/` roda **direto no Node ≥ 22.18**, sem build (TypeScript nativo),
  com Firebase Admin SDK.
- `tests/` são testes de integração contra o Emulator; `firestore.rules` e
  `firestore.indexes.json` na raiz.
- Visual: cores como variáveis em `src/index.css` (`fundo`, `cartao`, `borda`,
  `texto`, `suave`, `destaque`…) e classes `cartao`, `botao`, `campo`, `selo`,
  `tile`. Ícones: `lucide-react`. Não use cores fixas do Tailwind (`slate-…`).

## Armadilhas que já custaram caro

- **Importações com extensão `.ts`**: o que os scripts importam de `src/`
  precisa de `./arquivo.ts` nos imports de valor, senão quebra no Node puro
  (Vitest e `tsc` não acusam). `scripts/cli.test.ts` roda as CLIs para pegar isso.
- **Windows**: não compare `import.meta.url` com `` `file://${argv[1]}` ``; use
  `pathToFileURL`.
- **Prettier mexe nos dados de exemplo** (aspas do front matter): os
  exemplos ficam em `.prettierignore`.
- **`.firebaserc` aponta para um projeto de demonstração**: sempre passe
  `--project <id>` nos comandos do Firebase CLI.
- **Node 22 no CI**: `firebase-admin` exige Node ≥ 22; com Node 20 o npm pula
  o pacote opcional e os tipos dos scripts falham.
- **Consultas de leitor precisam provar o acesso**: a regra de leitura de
  `blocks` e `articles` depende de campos do documento, então uma consulta só
  passa se filtrar por eles (`productId` sempre; em artigos, também
  `status == 'published'` e, sem permissão técnica, `publico == 'usuario'`).
  Admin passa sem filtros, por isso o erro só aparece para leitor.
  `tests/rules/consultas-leitor.test.ts` cobre isso; use `getDoc` quando der.
- **Artigo publicado não se edita no lugar**: salvar um publicado grava uma
  _alteração pendente_ (`articles/{id}/revisoes/atual`) e a versão no ar só
  muda ao publicar a alteração. Toda mudança de estado passa por
  `transitar()` (`src/services/governanca.ts`), que valida pelo ciclo de
  `src/utils/ciclo.ts`, atualiza a busca e grava a auditoria. Não escreva
  `status` direto.
- **O servidor do assistente ignora as regras do Firestore** (Admin SDK):
  todo conteúdo que ele entrega à IA precisa ser conferido em código (publicado,
  produto permitido, técnico só para quem pode). Está em `carregarFontes`
  (`scripts/assistente/recuperar.ts`); não leia artigo por outro caminho.
- **Coleção nova nas regras exige linha na matriz de permissões**
  (`tests/rules/matriz-permissoes.test.ts`): o último teste dele falha se faltar.
- **O índice de busca tem duas coleções por produto**: `searchIndex` (artigos
  comuns) e `searchIndexTecnico` (só para quem tem `verTecnico`). Quem grava
  ou lê o índice precisa tratar as duas (`COLECOES_INDICE`, `separarPorColecao`
  e `juntarColecoes` em `src/utils/searchIndex.ts`); nunca ponha texto de
  artigo técnico na coleção comum.
- **Toda busca vale para um produto**: `useSearchEngine(produto?)` carrega só
  o índice do produto pedido ou do produto em contexto
  (`src/hooks/useProdutoEmContexto.ts`). Não volte a carregar todos os índices.
- **Seções e sinônimos da busca**: o item do índice leva `secoes` (título e
  posição em `textoPlano`), calculadas por `itemDoArtigo` **quando recebe o
  `conteudo`**: passe-o sempre. Os sinônimos ficam em `blocks/{produto}.sinonimos`
  (um grupo por item, termos separados por vírgula) e o motor os recebe em
  `criarMotor(itens, verTecnico, { sinonimos })`. O índice guarda o radical das
  palavras (`radical` em `src/utils/search.ts`, só plural).
- **Índice de busca tem teto de 1 MiB por documento**: toda gravação de parte
  passa por `caberNoLimite` (`src/utils/searchIndex.ts`), que encurta o texto
  em vez de deixar a publicação falhar.
- **Gravação no Firestore** pode dar `DEADLINE_EXCEEDED` em redes com
  proxy/VPN: o importador tenta de novo e aceita `--rest`. Rodar de novo é
  seguro (idempotente).

## Regras de trabalho

- **Não abra PR nem mescle sem o usuário pedir.** Mescla com commit de
  mesclagem. Nomes de branch em **português e claros** (ex.:
  `texto-alternativo-e-adaptador-smartshare-4`).
- A branch padrão é `claude/new-session-80yc6t`. As branches `fase-1-…` a
  `fase-4-…` são de outro trabalho e **não devem ser apagadas ou alteradas**
  sem perguntar.
- **Segredos nunca entram no repositório**: `.env*`, `service-account*.json` e
  chaves de API ficam fora (`.gitignore`). Não peça nem repita senhas e chaves.
- O repositório é **público**: nada de dados internos em fixtures. Backups são
  cifrados por isso.
- Sessões na nuvem **não alcançam `docs.selbetti.com.br`** (política de rede).
  Qualquer coisa que dependa dele (extrair a base, baixar imagens) roda na
  máquina do usuário.
- A IA nunca publica: `doc-sync` e `alt-texto` só criam **sugestões**, que um
  admin aprova na tela "Sugestões".
- Seja honesto sobre o que **não** foi exercitado de verdade (API da
  Anthropic, Cloudinary, GitHub Actions agendadas dependem de segredos).

## Ambiente do usuário (Windows)

- Projeto em `C:\projetos\docs-hub`; dados do SmartShare em
  `C:\projetos\dados` (`kb\smartshare-4\…` e `export-neutro`); chave do
  Firebase em `C:\projetos\service-account-dev.json` (fora do repositório).
- Projeto Firebase de teste: `docs-hub-dev-16c1f` (região `southamerica-east1`).
  O de produção ainda não existe.
- O usuário prefere **passo a passo para o `cmd`/PowerShell**, comandos
  copiáveis, sem presumir conhecimento de terminal, e conferir o resultado de
  cada passo antes do seguinte. Explique o porquê dos erros em linguagem simples.
- Depois de `git pull`, se reclamar do `package-lock.json`:
  `git checkout -- package-lock.json`.

## Estado atual (resumo; detalhes em `docs/roadmap.md`)

- Fases 0 a 7 e o novo visual estão na branch padrão. Do roadmap do time
  (`docs/roadmap.md`), já estão feitas as Fases 1 a 5 e o editor com modelos e
  tabelas (que fecha a Fase 2): BU e categorias; fila de revisão; ingestão de
  `.md`/`.html`/`.txt` (sem `.docx`/`.pdf`); busca com filtros, categorias e
  relacionados; governança (ciclo de vida de 6 estados, comentários, alteração
  pendente de artigo publicado, auditoria); assistente de IA com RAG sem
  embeddings; Fase 6 inteira (sincronização com vigília da pasta, workflow de
  Git e painel; avaliação de qualidade da IA; matriz de permissões; desempenho).
  O roadmap do time está concluído em código: o que sobra é de dados, de
  configuração e de testes com dados e chaves reais (veja abaixo).
- O assistente de IA roda só localmente (`npm run assistente`): falta escolher
  a hospedagem de produção.
- Base do SmartShare 4 importada **só com texto** no Firebase `dev`
  (10 blocos, 57 artigos); imagens ainda não migradas (211 marcadores
  `[Imagem não migrada: …]`).
- Pendentes principais: imagens (Cloudinary), textos alternativos (IA), regra
  de público "técnico", projeto de produção, segredos dos workflows do GitHub,
  onde ficam os `.md` de regras do `doc-sync`.
