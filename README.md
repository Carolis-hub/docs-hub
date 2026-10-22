# docs-hub

Plataforma interna da Selbetti para hospedar a documentação técnica e de
usuário dos produtos (ex.: Smartshare → BPM, ECM). O plano completo do
projeto está em [PLAN.md](./PLAN.md).

## Stack

- React 18 + TypeScript (modo strict) + Vite
- Tailwind CSS, com tema claro/escuro
- Firebase Auth (e-mail/senha) + Firestore, sem backend próprio — acesso
  direto do navegador, plano Spark
- Cloudinary para mídia (PNG, GIF, MP4), a partir da Fase 1
- TipTap para o editor de artigos, a partir da Fase 1
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

Pendente (fora do Claude Code, ver seção "Configuração necessária" acima e a
seção 8 do `PLAN.md`):

- [ ] Criação dos projetos Firebase `dev`/`prod`
- [ ] Conta e preset do Cloudinary
- [ ] Levantamento da ferramenta de documentação atual (formato de
      exportação e volume, necessário para a Fase 5)

**Fase 1 — Estrutura e conteúdo**, implementada em código:

- [x] CRUD de blocos com hierarquia, ordenação por arrastar (dnd-kit) e
      `productId` desnormalizado
- [x] CRUD de artigos (rascunho/publicado, `publico`, `versaoProduto`)
- [x] Editor TipTap (H1–H3, listas, links, código, imagem/GIF com texto
      alternativo obrigatório)
- [x] Upload para o Cloudinary com validação (tipo, 5 MB) e compressão de PNG
- [x] `textoPlano` e `resumo` gerados ao salvar
- [x] Histórico de versões a cada publicação, com restauração
- [x] Leitura: produtos → subprodutos → artigos, com breadcrumb
- [x] `firestore.rules` cobrindo `users`, `blocks` e `articles`, com testes
      (o restante das regras vem na Fase 2)

**Fase 2 — Usuários e permissões**, implementada em código:

- [x] `firestore.rules` completo (`users`, `blocks`, `articles`, `viewsDaily`,
      `searchIndex`, `auditLog`), com 17 testes no Emulator
- [x] Tela admin "Usuários": criar (segunda instância do Firebase), editar
      papel, produtos permitidos e `verTecnico`, desativar e reativar
- [x] Rotas protegidas por papel; conta sem perfil ou desativada vê "Sem acesso"
- [x] `auditLog` gravado no mesmo batch das ações de criar, editar, publicar e
      excluir (blocos, artigos e usuários)

O primeiro admin precisa ser criado à mão: crie a conta no Authentication do
console e o documento `users/{uid}` com `role: "admin"`, `ativo: true`. Os
demais usuários são criados pela tela "Usuários". Para enviar imagens, falta
configurar o Cloudinary.

**Fase 3 — Busca**, implementada em código:

- [x] `searchIndex/{productId}` atualizado em transação ao publicar, editar
      artigo publicado, despublicar e excluir
- [x] Índices carregados uma vez por sessão, com cache persistente do Firestore
- [x] MiniSearch com título de maior peso, sem acentos, prefixo e fuzzy
- [x] Página `/busca` com trecho destacado e filtros por produto e público
- [x] Busca rápida no cabeçalho com `Ctrl+K` (ou `⌘K`)
- [x] Buscas sem resultado agregadas em `searchMisses`
- [x] Índice dividido por subproduto (`partes/`) perto de 800 KB

Os artigos já publicados antes da Fase 3 não estão no índice: basta
republicá-los (ou salvá-los) para entrarem. A migração da Fase 5 já gravará o
índice.

Próxima fase: **Fase 4 — Métricas** (ver `PLAN.md`).
