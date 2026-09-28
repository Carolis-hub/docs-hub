# docs-hub

Plataforma interna da Selbetti para hospedar a documentação técnica e de
usuário dos produtos (ex.: Smartshare → BPM, ECM). O plano completo do
projeto está em [PLAN.md](./PLAN.md).

## Stack

- React 18 + TypeScript (modo strict) + Vite
- Tailwind CSS, com tema claro/escuro
- Firebase Auth (e-mail/senha) + Firestore, sem backend próprio — acesso
  direto do navegador, plano Spark
- Cloudinary para mídia (PNG, GIF, MP4), com compressão de PNG no navegador
- TipTap para o editor de artigos (estilos semânticos: H1–H3, parágrafo,
  listas, links, código, imagem com alt obrigatório)
- `@dnd-kit` para a ordenação por arrastar dos blocos
- MiniSearch para a busca, a partir da Fase 3
- ESLint + Prettier
- Vitest + Testing Library
- `@firebase/rules-unit-testing` para testar `firestore.rules` no Emulator

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com as credenciais do projeto Firebase de dev
npm run dev
```

Para desenvolver contra o Firebase Emulator (Auth + Firestore) em vez de um
projeto real, defina `VITE_USE_FIREBASE_EMULATOR=true` no `.env` e, em outro
terminal, rode:

```bash
npm run emulators
```

## Configuração necessária

Para rodar o projeto completo (fora do escopo da Fase 0, mas necessário nas
próximas fases), alguém com acesso precisa configurar manualmente:

1. **Projetos Firebase** `docs-hub-dev` e `docs-hub-prod`, no plano Spark,
   com Authentication (e-mail/senha) e Firestore habilitados. As chaves de
   cada projeto vão no `.env` correspondente (ver `.env.example`).
2. **Conta Cloudinary** (plano gratuito) com um upload preset **sem
   assinatura** e restrito: pasta fixa, formatos `png/jpg/gif/mp4/webm`,
   limite de 5 MB.
3. **Secrets do GitHub** (para as Actions das Fases 6 e 7): credenciais de
   service account do Firebase, chave da API de IA e credenciais da API do
   Cloudinary.
4. **Primeiro usuário admin**: como a tela "Usuários" (Fase 2) só existe
   dentro do app e só admins podem criar usuários, o primeiro admin precisa
   ser criado manualmente uma única vez: crie a conta em Authentication no
   Console do Firebase (ou no emulador) e, em Firestore, crie o documento
   `users/{uid}` correspondente com `role: "admin"`, `ativo: true`,
   `produtosPermitidos: []` e `verTecnico: true`. A partir daí, esse admin
   cria os demais usuários pela própria interface.

## Scripts

| Comando                | Descrição                                             |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Sobe o servidor de desenvolvimento do Vite            |
| `npm run build`        | Checa os tipos e gera o build de produção             |
| `npm run preview`      | Serve o build de produção localmente                  |
| `npm run lint`         | Roda o ESLint                                         |
| `npm run format`       | Formata os arquivos com o Prettier                    |
| `npm run format:check` | Verifica a formatação sem alterar arquivos            |
| `npm run typecheck`    | Checagem de tipos do TypeScript, sem gerar arquivos   |
| `npm run test`         | Roda os testes unitários com Vitest                   |
| `npm run test:watch`   | Roda os testes unitários em modo watch                |
| `npm run emulators`    | Sobe o Firebase Emulator (Auth + Firestore)           |
| `npm run test:rules`   | Roda os testes de `firestore.rules` contra o Emulator |

## Status

**Fase 0 — Setup**, concluída no que depende de código:

- [x] Projeto Vite + React + TS + Tailwind, com tema claro/escuro
- [x] ESLint + Prettier + Vitest configurados
- [x] Estrutura de pastas do `PLAN.md`
- [x] `src/services/firebase.ts` lendo do `.env`, com suporte ao Emulator
- [x] `firebase.json` e `firestore.rules` inicial (nega tudo)
- [x] Tela de login (e-mail/senha) e layout base com cabeçalho e alternância
      de tema
- [x] `ci.yml` com lint, typecheck, testes e build

**Fase 1 — Estrutura e conteúdo**, concluída:

- [x] CRUD de blocos (produtos → subprodutos) com ordenação por arrastar
- [x] CRUD de artigos: rascunho, publicação, público (usuário/técnico) e
      versão do produto opcional
- [x] Editor TipTap com estilos semânticos e imagem/GIF com alt obrigatório
- [x] Upload para o Cloudinary com validação e compressão de PNG
- [x] Geração automática de `textoPlano` e `resumo`
- [x] Histórico de versões a cada publicação, com opção de restaurar
- [x] Leitura por produto → subproduto → artigo, com breadcrumb

O fluxo completo (criar produto, subproduto e artigo, publicar e visualizar)
foi validado manualmente contra o Firebase Emulator.

**Fase 2 — Usuários e permissões**, concluída:

- [x] `firestore.rules` completo: sem perfil ou com `ativo: false`, nega
      tudo; leitor só lê o que está em `produtosPermitidos` e, para
      conteúdo técnico, só com `verTecnico`; leitor só altera `views`; admin
      lê e escreve tudo, exceto excluir `auditLog`
- [x] 19 testes em `tests/rules`, rodando no CI com o Firestore Emulator
- [x] Tela admin "Usuários": cria (via instância secundária do Firebase, sem
      derrubar a sessão do admin), edita papel/produtos/`verTecnico` e
      desativa/reativa
- [x] Rotas `/admin/*` protegidas por papel no front (`RequireAdmin`), com a
      navegação também escondida para quem não é admin
- [x] `auditLog` registrado ao criar, editar, publicar, despublicar e
      excluir blocos, artigos e usuários

Validado manualmente: um leitor restrito a um produto não vê os demais na
home, nem por URL direta de bloco ou artigo, nem acessa `/admin/*`.

Pendente (fora do Claude Code, ver seção "Configuração necessária" acima e a
seção 8 do `PLAN.md`):

- [ ] Criação dos projetos Firebase `dev`/`prod`
- [ ] Conta e preset do Cloudinary
- [ ] Criação manual do primeiro usuário admin (ver "Configuração necessária")
- [ ] Levantamento da ferramenta de documentação atual (formato de
      exportação e volume, necessário para a Fase 5)

Próxima fase: **Fase 3 — Busca** (ver `PLAN.md`).
