# docs-hub

Plataforma interna da Selbetti para hospedar a documentação dos produtos
(produtos → subprodutos → artigos), com busca, métricas, sugestões de
atualização por IA e migração da base atual (`docs.selbetti.com.br`).
Interface e documentação em **português do Brasil**.

## Onde ler primeiro

- `PLAN.md`: decisões de arquitetura, modelo de dados, regras de segurança e
  as fases (0 a 7, todas implementadas em código).
- `docs/roadmap.md`: o que falta e o que vem a seguir. **Atualize ao terminar
  uma tarefa** (marque o item e faça commit).
- `README.md`: como rodar, checklist de configuração dos workflows do GitHub.
- `scripts/<pasta>/README.md`: cada ferramenta (migrate, doc-sync, alt-texto,
  backup, cloudinary-limpeza, verificar-links) tem o seu.

## Comandos

| Comando                                                 | Para quê                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| `npm run dev`                                           | Sistema em `http://localhost:5173`                                |
| `npm test`                                              | Testes unitários (Vitest)                                         |
| `npm run test:rules`                                    | Regras do Firestore e scripts contra o Emulator (precisa de Java) |
| `npm run lint` / `typecheck` / `format:check` / `build` | Conferências que o CI também roda                                 |
| `npm run migrate -- <pasta> …`                          | Importador (simulação por padrão; `--gravar` grava)               |
| `npm run alt-texto -- …`                                | Sugere textos alternativos de imagens (IA)                        |
| `npm run doc-sync -- …`                                 | Sugere atualizações de artigos a partir de `.md` de regras        |

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

- Fases 0 a 7 e o novo visual estão na branch padrão.
- Base do SmartShare 4 importada **só com texto** no Firebase `dev`
  (10 blocos, 57 artigos); imagens ainda não migradas (211 marcadores
  `[Imagem não migrada: …]`).
- Pendentes principais: imagens (Cloudinary), textos alternativos (IA), regra
  de público "técnico", projeto de produção, segredos dos workflows do GitHub,
  onde ficam os `.md` de regras do `doc-sync`.
