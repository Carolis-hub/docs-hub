# docs-hub — Plano do projeto

## 1. Contexto

Plataforma interna da Selbetti para hospedar a documentação técnica e de usuário dos produtos (ex.: Smartshare → BPM, ECM). Ela substitui a ferramenta atual, que tem três problemas:

- A busca não encontra conteúdo dentro dos artigos.
- A edição usa componentes proprietários, o que dificulta atualizar a documentação com IA.
- Não há métricas de acesso por artigo.

### Objetivos

1. Buscar de forma rápida por título **e** por conteúdo.
2. Organizar o conteúdo em **produtos → subprodutos → artigos**, com quantos blocos forem necessários.
3. Artigos com títulos, parágrafos, imagens PNG e GIFs.
4. Usuários com papéis **leitor** e **admin**, criados manualmente por um admin.
5. Contagem de acessos por artigo.
6. Integração com os repositórios dos produtos, para que uma alteração no código gere uma **sugestão** de atualização da documentação feita por IA.

## 2. Decisões de arquitetura

| Tema                  | Decisão                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Stack                 | React 18 + TypeScript + Vite + Tailwind, igual ao QA-Hub                                                              |
| Backend               | Nenhum. Firebase acessado direto do navegador                                                                         |
| Plano Firebase        | **Spark (gratuito)**, com dois projetos: `docs-hub-dev` e `docs-hub-prod`                                             |
| Autenticação          | Firebase Auth com e-mail e senha                                                                                      |
| Criação de usuários   | Manual, pelo admin, na tela "Novo usuário" do painel. Usa uma segunda instância do Firebase para não deslogar o admin |
| Banco                 | Firestore                                                                                                             |
| Mídia (PNG, GIF, MP4) | **Cloudinary** (plano gratuito), com upload direto do navegador via preset sem assinatura e restrito                  |
| Editor                | TipTap, somente com estilos semânticos (Título 1, 2, 3 e parágrafo), sem tamanho livre de fonte                       |
| Busca                 | MiniSearch no navegador, sobre índices agregados por produto (`searchIndex/{productId}`)                              |
| IA no editor          | Camada multi-provedor reaproveitada do QA-Hub, restrita a admins                                                      |
| IA automática         | GitHub Action nos repositórios de produto. Grava **sugestões**, nunca publica                                         |
| Métricas              | Contadores agregados (total e por dia), leitor único por dia, sem contar admins, sem log individual (LGPD)            |
| Backup                | GitHub Action noturna que exporta o Firestore em JSON como artifact                                                   |
| Hierarquia            | Ilimitada no banco via `parentId`. A interface é otimizada para 3 níveis. Artigos podem ficar em qualquer bloco       |
| Público do artigo     | `usuario` ou `tecnico`. O leitor só vê artigos técnicos se tiver `verTecnico: true`                                   |
| Permissão por produto | O leitor só vê os produtos listados em `produtosPermitidos`                                                           |

### Comparação com o QA-Hub

| Camada                 | QA-Hub                                     | docs-hub                                         |
| ---------------------- | ------------------------------------------ | ------------------------------------------------ |
| Frontend, estilo, tema | React + TS + Vite + Tailwind, claro/escuro | Igual                                            |
| Backend                | Nenhum                                     | Nenhum                                           |
| Auth                   | E-mail e senha, contas criadas no console  | E-mail e senha, contas criadas pelo admin no app |
| Papéis                 | Sem papéis                                 | `reader` e `admin`, com permissão por produto    |
| Banco e regras         | Firestore + `firestore.rules`              | Firestore + regras mais complexas **com testes** |
| Mídia                  | Não usa                                    | Cloudinary                                       |
| Busca                  | Não tem                                    | MiniSearch                                       |
| IA                     | Multi-provedor, chave no perfil            | Mesma camada, restrita a admins                  |
| Automação              | Não tem                                    | Actions de sincronização e de backup             |
| Plano                  | Spark                                      | Spark                                            |

## 3. Estrutura do repositório

```
docs-hub/
├── .github/workflows/
│   ├── ci.yml              # lint, typecheck, testes, build
│   ├── doc-sync.yml        # workflow reutilizável pelos repos de produto
│   └── backup.yml          # export noturno do Firestore
├── scripts/
│   ├── doc-sync/           # Node + Admin SDK + IA: gera sugestões
│   ├── backup/             # export do Firestore em JSON
│   └── migrate/            # importação da ferramenta atual
├── src/
│   ├── components/         # layout, cards, editor, busca, tema
│   ├── pages/              # Home, Bloco, Artigo, Busca, Admin/*, Configurações, Login
│   ├── services/           # firebase.ts, blocks.ts, articles.ts, users.ts,
│   │                       # search.ts, media.ts (Cloudinary), metrics.ts, ai/
│   ├── hooks/
│   ├── types/
│   └── utils/
├── tests/rules/            # testes do firestore.rules no Emulator
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
├── .env.example
├── PLAN.md
└── README.md
```

### Variáveis de ambiente (`.env.example`)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
```

## 4. Modelo de dados (Firestore)

```
blocks/{blockId}
  nome, slug, descricao, icone, ordem
  parentId          (null = produto)
  productId         (id do produto raiz, desnormalizado; no produto = o próprio id)

articles/{articleId}
  blockId, productId, titulo, slug, resumo
  conteudo          (JSON do TipTap)
  textoPlano        (texto sem formatação, para busca e IA)
  publico           ("usuario" | "tecnico")
  versaoProduto?    (opcional, preparado para versionamento futuro)
  status            ("draft" | "published")
  flags             (ex.: ["prints_desatualizados"])
  views             (total)
  versao, autorId, atualizadoPor, criadoEm, atualizadoEm, revisadoEm

articles/{id}/versions/{versao}      snapshot do conteúdo + origem ("manual" | "ia")
articles/{id}/suggestions/{sid}      sugestão da IA: conteudo, diffResumo, repo, commit, status
articles/{id}/viewsDaily/{AAAA-MM-DD} { count }

users/{uid}
  nome, email, role ("reader" | "admin")
  produtosPermitidos[]   (ids de produto; admins veem tudo)
  verTecnico             (bool)
  aiProvider?, aiKey?    (só admins)

searchIndex/{productId}
  itens[]: { id, titulo, resumo, textoPlano (truncado), blockId, publico }

auditLog/{id}
  usuarioId, acao, alvo, data
```

A sugestão da IA fica em uma subcoleção, então a versão publicada continua no ar enquanto a sugestão aguarda revisão.

## 5. Regras de segurança (resumo)

- Sem documento `users/{uid}` → nenhum acesso. Isso protege contra contas criadas fora do fluxo do admin.
- **Leitor:**
  - Lê blocos e artigos `published` cujo `productId` está em `produtosPermitidos`.
  - Artigos `tecnico` só com `verTecnico`.
  - Lê apenas os `searchIndex` dos seus produtos.
  - Só altera `views` (+1) e `viewsDaily` (+1).
  - Lê apenas o próprio `users/{uid}` e não altera nada nele.
- **Admin:** lê e escreve tudo, exceto excluir `auditLog`.
- Ninguém lê o `users` de outra pessoa, com exceção dos admins.

## 6. Roadmap

Estimativa total: **11 a 14 semanas** para uma pessoa.

### Fase 0 — Setup (≈1 semana)

- [x] Repositório no padrão do QA-Hub: Vite, TS, Tailwind, tema claro/escuro, ESLint, Prettier.
- [ ] Projetos Firebase `dev` e `prod` no Spark, com Auth por e-mail e senha e Firestore. _(manual, fora do Claude Code)_
- [x] Firebase Emulator (Auth + Firestore) e scripts `npm run emulators` e `npm run test:rules`.
- [ ] Conta Cloudinary com preset sem assinatura restrito: pasta fixa, formatos png/jpg/gif/mp4/webm, até 5 MB. _(manual, fora do Claude Code)_
- [x] `ci.yml` com lint, typecheck, testes e build.
- [ ] Levantamento da ferramenta atual: formato de exportação e volume. _(pendência, ver seção 8)_

**Pronto quando:** `npm run dev` sobe a aplicação com tema e login, e o CI passa.

### Fase 1 — Estrutura e conteúdo (≈3 semanas)

- [x] CRUD de blocos com hierarquia, ordenação por arrastar e `productId` desnormalizado.
- [x] CRUD de artigos: rascunho e publicado, campo `publico` e `versaoProduto` opcional.
- [x] Editor TipTap:
  - [x] Títulos H1 a H3, parágrafo, listas, links e código.
  - [x] Imagem e GIF com **texto alternativo obrigatório**.
- [x] Upload para o Cloudinary com validação de tipo e tamanho, e compressão de PNG no navegador.
- [x] Geração de `textoPlano` e `resumo` ao salvar.
- [x] Histórico de versões a cada publicação, com opção de restaurar.
- [x] Leitura: cards de produto, depois subprodutos, depois artigos, com breadcrumb e renderização do artigo.

**Pronto quando:** um admin cria o produto Smartshare, o subproduto BPM e um artigo com texto e GIF, publica, e o artigo aparece corretamente. ✅ Verificado manualmente via Firebase Emulator (regras temporariamente permissivas só para o teste local, revertidas antes do commit — o `firestore.rules` de produção continua "nega tudo" até a Fase 2). O upload real para o Cloudinary depende da conta/preset ainda não configurados (seção 8); o fluxo foi validado inserindo uma imagem por URL, e o código de upload (`services/media.ts`) está coberto por testes unitários.

### Fase 2 — Usuários e permissões (≈1 semana)

- [x] `firestore.rules` completo, conforme a seção 5.
- [x] Testes das regras no Emulator (`@firebase/rules-unit-testing`), rodando no CI.
- [x] Tela admin "Usuários": criar (via segunda instância do Firebase), editar papel, produtos permitidos e `verTecnico`, e desativar.
- [x] Rotas protegidas por papel no front.
- [x] Gravação de `auditLog` nas ações de criar, editar, publicar e excluir.

**Pronto quando:** um leitor com acesso só ao ECM não vê BPM nem na navegação, nem na busca, nem por URL direta, e os testes provam isso. ✅ 19 testes em `tests/rules` provam o isolamento por produto, papel, status e público técnico (a parte de busca é da Fase 3). Verificado também manualmente via Emulator: um admin criou os produtos Smartshare e ECM e um leitor restrito à ECM; a navegação, a home e a URL direta do Smartshare ficaram bloqueadas para esse leitor, e `/admin/*` retornou "Acesso restrito a administradores".

### Fase 3 — Busca (≈1–2 semanas)

- [x] Atualizar `searchIndex/{productId}` ao publicar ou despublicar, dentro de um batch.
- [x] Carregar os índices permitidos uma vez por sessão, com cache persistente do Firestore.
- [x] MiniSearch configurado:
  - [x] Título com peso maior que o conteúdo.
  - [x] Normalização de acentos.
  - [x] Busca por prefixo e fuzzy.
- [x] Página de resultados com trecho destacado e filtros por produto e por público.
- [x] Busca rápida no cabeçalho com atalho `Ctrl+K`.
- [x] Registro agregado de buscas sem resultado.
- [~] Se um índice se aproximar de 1 MB, dividir por subproduto. _Implementado como aviso_: `avisarSeIndiceGrande` registra um `console.warn` quando um índice passa de ~900 KB, mas a divisão em si (por subproduto) ainda é manual — não há volume real de conteúdo hoje que justifique automatizar isso.

**Pronto quando:** buscar "configuracao" encontra "Configuração" no título e no corpo, respeitando as permissões. ✅ Verificado manualmente via Emulator: um admin publicou artigos no Smartshare/BPM e na ECM, e a busca por "configuracao" (sem acento) encontrou tanto o artigo com o termo no título quanto o que só tinha "configuração" no corpo, incluindo via `Ctrl+K`. Um leitor restrito à ECM viu apenas o artigo da ECM na mesma busca — os artigos do Smartshare não apareceram nem por título nem por corpo.

### Fase 4 — Métricas (≈1 semana)

- [ ] Incremento de `views` e `viewsDaily` com `increment()`, deduplicado por leitor, artigo e dia no navegador, sem contar admins.
- [ ] Painel admin:
  - [ ] Artigos mais acessados.
  - [ ] Evolução por período.
  - [ ] Artigos sem acesso.
  - [ ] Buscas sem resultado.
  - [ ] Artigos sem revisão há mais de X meses.
- [ ] Estimativa de consumo das cotas do Spark: 50 mil leituras e 20 mil gravações por dia.

### Fase 5 — Migração (≈1–2 semanas)

- [ ] `scripts/migrate`: importar blocos, artigos e imagens da ferramenta atual para o Cloudinary e o Firestore. Rodar primeiro no `dev`.
- [ ] Relatório de validação: imagens com falha, links quebrados e artigos sem bloco.
- [ ] Período de convivência com a ferramenta antiga em modo só leitura, depois desligamento.

### Fase 6 — Integração com os repositórios de produto (≈2 semanas)

- [ ] `doc-sync.yml` como workflow reutilizável (`workflow_call`).
- [ ] `docs-map.yml` no repositório do produto, mapeando caminhos para artigos (`src/login/** → articleId`).
- [ ] `scripts/doc-sync`:
  - [ ] Lê o diff do merge.
  - [ ] Chama a IA com o diff e o artigo atual.
  - [ ] Grava em `articles/{id}/suggestions`.
  - [ ] Marca `prints_desatualizados` quando o diff toca arquivos de interface.
- [ ] Tela de revisão: comparação lado a lado entre a versão atual e a sugestão, com as opções aprovar, editar ou descartar.
- [ ] Credenciais (service account e chave de IA) em GitHub Secrets.

**Pronto quando:** um merge no repositório do produto gera uma sugestão visível para o admin, e nada é publicado sem aprovação.

### Fase 7 — Operação e backlog

- [ ] `backup.yml`: export noturno do Firestore em JSON como artifact do workflow.
- [ ] Limpeza periódica de imagens órfãs no Cloudinary, via Action com a API secret.
- [ ] Verificador de links quebrados.
- Backlog:
  - Interface de versões por versão do produto.
  - Botão "Este artigo foi útil?".
  - Busca semântica.
  - Exportação em PDF.

## 7. Limites e riscos conhecidos

- **Cotas do Spark:** ao estourar a cota diária, o app para até o dia seguinte. As mitigações são cache persistente, índice carregado uma vez por sessão e deduplicação de acessos.
- **Preset do Cloudinary exposto no front:** mitigado pelas restrições do preset. Excluir imagens exige a API secret, por isso a limpeza roda em uma Action.
- **Cadastro por e-mail e senha habilitado no Auth:** alguém poderia criar uma conta vazia, mas sem `users/{uid}` as regras negam todo acesso.
- **IA:** nunca publica diretamente. Prints de tela não são atualizados pela IA, apenas sinalizados.

## 8. Pendências

- [ ] Qual é a ferramenta atual e seu formato de exportação (Fase 5).
- [ ] Se a base de conhecimento do QA-Hub migra para o docs-hub como produto "QA".
