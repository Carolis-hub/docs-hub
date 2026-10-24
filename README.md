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
   Cloudinary. O passo a passo está na seção seguinte.

## Configuração dos workflows do GitHub

Checklist para ligar as Actions, na ordem do menos arriscado para o mais. Os
segredos e variáveis ficam em **GitHub → Settings → Secrets and variables →
Actions** (segredos na aba _Secrets_, variáveis na aba _Variables_). Os
workflows agendados só passam a rodar depois que este código estiver na branch
padrão; antes disso dá para criar os segredos, mas o "Run workflow" manual só
aparece depois da mesclagem.

### 0. Pré-requisitos

- [ ] Projetos Firebase `docs-hub-dev` e `docs-hub-prod` criados, com Firestore
      e Authentication (e-mail e senha).
- [ ] Regras e índices publicados em cada projeto:
      `firebase deploy --only firestore:rules,firestore:indexes --project <id>`.
- [ ] Conta do Cloudinary e o preset sem assinatura (pasta fixa, formatos
      `png/jpg/gif/mp4/webm`, até 5 MB), como descrito acima.
- [ ] Primeiro admin criado à mão: a conta em Authentication e o documento
      `users/{uid}` com `role: "admin"` e `ativo: true`.

**Comece pelo `dev`.** Aponte `FIREBASE_PROJECT_ID` para o `dev`, rode cada
workflow à mão, confira, e só então troque para o `prod`.

### 1. Service accounts (duas, com permissões mínimas)

Crie no **Google Cloud Console** do projeto (_IAM e administrador → Contas de
serviço → Criar conta de serviço_), não pelo botão "Gerar nova chave privada" do
console do Firebase, que usa uma conta com permissões bem maiores:

| Conta              | Papel (IAM)              | Usada por                                         |
| ------------------ | ------------------------ | ------------------------------------------------- |
| `docs-hub-leitura` | `Cloud Datastore Viewer` | `verificar-links`, `backup`, `limpeza-cloudinary` |
| `docs-hub-escrita` | `Cloud Datastore User`   | `doc-sync` (grava sugestões)                      |

Para cada uma: abra a conta → aba _Chaves_ → _Adicionar chave_ → _Criar nova
chave_ → **JSON**. O conteúdo inteiro do arquivo vira o valor do segredo
`FIREBASE_SERVICE_ACCOUNT`. Depois apague o arquivo baixado do seu computador.
Crie contas separadas para `dev` e `prod`.

### 2. Verificar links (só leitura)

- [ ] Variável `FIREBASE_PROJECT_ID` (ex.: `docs-hub-dev`)
- [ ] Segredo `FIREBASE_SERVICE_ACCOUNT` (chave da conta `docs-hub-leitura`)
- [ ] Actions → _Verificar links_ → _Run workflow_; abra o resumo da execução e
      o artifact `relatorio-links`

### 3. Backup noturno

- [ ] Segredo `BACKUP_PASSPHRASE`: uma senha longa e aleatória (por exemplo,
      `openssl rand -base64 32`)
- [ ] **Guarde a mesma senha fora do GitHub** (gerenciador de senhas). Sem ela o
      backup cifrado não abre, e o repositório é público
- [ ] Actions → _Backup_ → _Run workflow_; baixe o artifact `firestore-backup`
- [ ] Teste a restauração no `dev`, em simulação:
      `BACKUP_PASSPHRASE=… node scripts/backup/restaurar.ts <arquivo>.enc --projeto docs-hub-dev`

### 4. Limpeza de imagens do Cloudinary (só relatório)

- [ ] Variável `CLOUDINARY_CLOUD_NAME` (aparece no Dashboard do Cloudinary)
- [ ] Segredos `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` (Dashboard →
      _Settings_ → _API Keys_; crie uma chave só para este uso)
- [ ] Opcional: variável `CLOUDINARY_FOLDER`, se as imagens ficam em uma pasta
- [ ] Actions → _Limpeza do Cloudinary_ → _Run workflow_ com `apagar` desmarcado
- [ ] Deixe `CLOUDINARY_LIMPEZA_APAGAR` **sem definir** por algumas semanas.
      Quando os relatórios estiverem confiáveis, crie a variável com o valor `true`

### 5. Sugestões por IA (por último)

Estes segredos ficam no **repositório que guarda os arquivos `.md` de regras**,
que ainda precisa ser definido (veja a seção 8 do `PLAN.md`), e não
necessariamente neste.

- [ ] Segredo `FIREBASE_SERVICE_ACCOUNT` (chave da conta `docs-hub-escrita`)
- [ ] Segredo `ANTHROPIC_API_KEY` (console da Anthropic → _API keys_)
- [ ] Nesse repositório, um workflow que chame o `doc-sync.yml` (exemplo no
      comentário do topo de `.github/workflows/doc-sync.yml`) com `projeto:`
      apontando para o `dev` no começo

### Resumo: quem usa o quê

| Workflow                 | Segredos                                                                  | Variáveis                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                 | nenhum                                                                    | nenhuma                                                                                                       |
| `verificar-links.yml`    | `FIREBASE_SERVICE_ACCOUNT`                                                | `FIREBASE_PROJECT_ID`                                                                                         |
| `backup.yml`             | `FIREBASE_SERVICE_ACCOUNT`, `BACKUP_PASSPHRASE`                           | `FIREBASE_PROJECT_ID`                                                                                         |
| `limpeza-cloudinary.yml` | `FIREBASE_SERVICE_ACCOUNT`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | `FIREBASE_PROJECT_ID`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_FOLDER` e `CLOUDINARY_LIMPEZA_APAGAR` (opcionais) |
| `doc-sync.yml`           | `FIREBASE_SERVICE_ACCOUNT`, `ANTHROPIC_API_KEY`                           | nenhuma (o projeto vai como `projeto:` na chamada)                                                            |

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

**Fase 4 — Métricas**, implementada em código:

- [x] `views` e `viewsDaily` com `increment()`, deduplicados por leitor, artigo
      e dia no navegador, sem contar admins
- [x] Painel `/admin/metricas`: mais acessados, evolução por período (gráfico e
      tabela), artigos sem acesso, buscas sem resultado e artigos sem revisão
      há mais de 3, 6 ou 12 meses
- [x] Estimativa de consumo das cotas do Spark em `docs/cotas-spark.md`

A consulta agregada de `viewsDaily` usa um índice de grupo de coleções em
`firestore.indexes.json`: faça `firebase deploy --only firestore:indexes`
junto com as regras.

**Fase 5 — Migração**, implementada em código (`scripts/migrate`):

- [x] Importador de blocos, artigos e imagens (Cloudinary + Firestore, via
      Admin SDK), idempotente, com simulação por padrão (`npm run migrate`)
- [x] Relatório de validação: imagens com falha, links quebrados, artigos sem
      bloco, erros e textos alternativos gerados
- [x] Adaptador da base atual (`docs.selbetti.com.br`, extraída pelo
      `smartshare-kb`) para o formato do importador
- [ ] Extração real, execução no `dev` e depois no `prod`
- [ ] Período de convivência e desligamento da ferramenta antiga (roteiro em
      `scripts/migrate/README.md`)

`npm run test:rules` agora também testa o importador contra o Emulator, e o
`ci.yml` ganhou um job `emulator` que o executa.

**Fase 6 — Sugestões de atualização por IA**, implementada em código. A
entrada é um arquivo `.md` com as regras do produto ou da funcionalidade:

- [x] `scripts/doc-sync`: compara as regras com o artigo, pede à IA a
      atualização e grava a sugestão em `articles/{id}/suggestions` (nunca
      publica); marca `prints_desatualizados` quando as telas mudam
- [x] `doc-sync.yml`, workflow reutilizável que roda nos arquivos de regras
      alterados
- [x] Telas **Sugestões** e de revisão (versão atual × sugestão), com aprovar,
      editar antes de aprovar e descartar
- [ ] Segredos no GitHub e definição de onde ficam os arquivos de regras

Veja `scripts/doc-sync/README.md`. Próxima fase: **Fase 7 — Operação e
backlog** (ver `PLAN.md`).

**Fase 7 — Operação**, implementada em código (cada pasta de `scripts/` tem um
README):

- [x] `backup.yml`: export noturno do Firestore, **cifrado**, como artifact
      (30 dias); `scripts/backup/restaurar.ts` para restaurar
- [x] `limpeza-cloudinary.yml`: imagens órfãs semanais, só relatório até
      `CLOUDINARY_LIMPEZA_APAGAR=true`
- [x] `verificar-links.yml`: links e imagens quebrados, semanal
- [ ] Segredos e variáveis dos workflows no GitHub

O backlog (versões por versão do produto, "foi útil?", busca semântica e PDF)
fica para depois.

**Textos alternativos** (`scripts/alt-texto`): sugere, com a IA vendo a imagem e
o texto ao redor, alts melhores para imagens sem descrição (a base do SmartShare
não tem nenhum). O resultado é uma sugestão revisada em "Sugestões", como no
`doc-sync`. Veja `scripts/alt-texto/README.md`.
