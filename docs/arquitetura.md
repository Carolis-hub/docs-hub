# Definição da Arquitetura Tecnológica: docs-hub

Plataforma interna da Selbetti para hospedar a documentação dos produtos,
organizada em **BU → produto → subproduto → módulo → artigo**. Tem busca,
métricas, governança editorial, assistente de IA e importação da base atual.

Este texto descreve o que está na branch padrão. O que ainda não foi exercitado
de verdade vem marcado. Detalhes de decisão e fases: `PLAN.md`; o que falta:
`docs/roadmap.md`; como rodar: `README.md`.

## 1. Visão geral

```
                  ┌───────────────────────── Navegador ─────────────────────────┐
                  │  React 18 + TypeScript + Vite + Tailwind (SPA)              │
                  │  MiniSearch (busca)   TipTap (editor)   Firebase SDK        │
                  └──────┬───────────────────┬───────────────────┬──────────────┘
                         │                   │                   │
                Firebase Auth          Firestore             Cloudinary
               (e-mail e senha)  (dados, regras, índices)     (imagens)
                         ▲                   ▲                   ▲
                         │                   │                   │
   ┌─────────────────────┴───────────────────┴───────────────────┴─────────────┐
   │ Scripts em Node ≥ 22.18 (sem build), com Firebase Admin SDK                │
   │ migrate · ingestao · estrutura · doc-sync · alt-texto · backup · verificar │
   └──────────────┬─────────────────────────────────────────────────────────────┘
                  │
   ┌──────────────┴─────────────┐         ┌─────────────────────────────┐
   │ Servidor do assistente de  │────────►│ API da Anthropic (Claude)   │
   │ IA (Node, Admin SDK)       │         └─────────────────────────────┘
   └────────────────────────────┘

   GitHub Actions: CI, backup noturno, doc-sync, ingestão,
   verificação de links e limpeza do Cloudinary
```

**Princípio central:** não há backend próprio para o uso do dia a dia. O
navegador fala direto com o Firebase, protegido por **regras de segurança
testadas**. Só o assistente de IA e as ferramentas de linha de comando rodam em
Node.

## 2. Camadas e tecnologias

### Frontend (`src/`)

| Item              | Tecnologia                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework         | React 18, TypeScript 5.5, React Router 7                                                                                                       |
| Build             | Vite 8, com divisão em pedaços (rotas carregadas sob demanda; Firebase e React em arquivos separados)                                          |
| Estilo            | Tailwind 3.4, com as cores como variáveis CSS (tema claro e escuro)                                                                            |
| Ícones            | lucide-react                                                                                                                                   |
| Editor            | TipTap 3 (títulos 1 a 3, listas, tabelas, imagens), só estilos semânticos                                                                      |
| Busca             | MiniSearch, no navegador, sobre o índice do produto em contexto (toda busca vale para um produto)                                              |
| Arrastar e soltar | dnd-kit (reordenar produtos e seções)                                                                                                          |
| Validação         | Zod 4                                                                                                                                          |
| Organização       | `pages/` (telas), `components/`, `services/` (acesso ao Firestore), `hooks/`, `utils/` (funções puras, reaproveitadas pelos scripts), `types/` |

### Dados e identidade

| Item         | Decisão                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticação | Firebase Auth, e-mail e senha. Contas criadas por um admin na própria tela (segunda instância do Firebase, para não deslogar o admin) |
| Banco        | Firestore. Região `southamerica-east1` no projeto de teste                                                                            |
| Papéis       | `admin` e `reader`. O leitor vê só os produtos de `produtosPermitidos` e só o conteúdo técnico se tiver `verTecnico`                  |
| Segurança    | `firestore.rules` com testes no Emulator (matriz de permissões: cada coleção contra cada tipo de pessoa)                              |
| Planos       | Spark (gratuito), com cotas monitoradas. Projeto de teste `docs-hub-dev-16c1f`; o de produção **ainda não existe**                    |
| Mídia        | Cloudinary (plano gratuito), com envio direto do navegador por preset sem assinatura                                                  |

### Modelo de dados (coleções principais)

| Coleção                                                                                  | Conteúdo                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unidades`                                                                               | BUs                                                                                                                                                                                               |
| `blocks`                                                                                 | Produtos (raiz) e subníveis, por `parentId`; produtos têm `unidadeId`, `descricao` e `ficha` (as 5 opções fixas)                                                                                  |
| `articles` (+ `versions`, `revisoes`, `comentarios`, `suggestions`, `viewsDaily`)        | Artigos e seus bastidores                                                                                                                                                                         |
| `searchIndex/{produto}` e `searchIndexTecnico/{produto}` (+ `partes`)                    | Índice de busca por produto: artigos comuns numa coleção, técnicos na outra (só para quem tem `verTecnico`). Cada uma é dividida por subproduto ao passar de ~800 KB (teto de 1 MiB do Firestore) |
| `users`                                                                                  | Perfil e permissões                                                                                                                                                                               |
| `preferenciasUsuario/{uid}`                                                              | Configurações pessoais (aside); só o dono lê e grava                                                                                                                                              |
| `auditLog`, `searchMisses`, `fontes`, `sincronizacoes`, `assistenteUso`, `assistenteLog` | Trilha, métricas e controles                                                                                                                                                                      |

Toda coleção nova nas regras exige uma linha na matriz de permissões
(`tests/rules/matriz-permissoes.test.ts`).

### Regras de negócio com impacto na arquitetura

- **Ciclo de vida do artigo:** rascunho → em revisão → aprovado → publicado
  (mais reprovado e arquivado). Toda mudança passa por `transitar()`
  (`src/services/governanca.ts`), que valida o ciclo (`src/utils/ciclo.ts`),
  atualiza a busca e grava a auditoria. Não se escreve `status` direto.
- **Artigo publicado não se edita no lugar:** salvar cria uma alteração
  pendente (`articles/{id}/revisoes/atual`); a versão no ar só muda ao publicar
  a alteração.
- **A IA nunca publica:** `doc-sync` e `alt-texto` só criam sugestões, que um
  admin aprova.
- **Métricas sem log individual** (LGPD): contadores por artigo e por dia,
  leitor único por dia, sem contar admins.
- **Consultas de leitor precisam provar o acesso** pelos filtros (`productId`
  sempre; em artigos, também `status == 'published'` e, sem permissão técnica,
  `publico == 'usuario'`).

## 3. Assistente de IA

| Item           | Decisão                                                                                                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modelo         | Claude, via SDK da Anthropic, com saída estruturada e citações validadas                                                                                                                                                          |
| Onde roda      | Servidor Node próprio (`npm run assistente`), **só local por enquanto**; hospedagem de produção indefinida (o plano Spark não roda servidor)                                                                                      |
| Segurança      | O servidor usa o Admin SDK (ignora as regras do Firestore), então confere em código o que a pessoa pode ler (publicado, produto permitido, técnico só para quem pode); veja `carregarFontes` em `scripts/assistente/recuperar.ts` |
| Busca de apoio | Sem embeddings: reformulação da pergunta pela IA, busca por palavras (MiniSearch) com sinônimos, fusão das listas e escolha final pela IA                                                                                         |
| Respostas      | Só com o que está nos artigos, com citação `[n]`; se não achar, diz que não achou                                                                                                                                                 |
| Controles      | 30 perguntas por pessoa por dia, teto diário de gasto, registro de uso e avaliação (útil ou ruim)                                                                                                                                 |
| Chave de IA    | A do servidor ou a própria da pessoa (só no navegador, enviada por cabeçalho e nunca gravada)                                                                                                                                     |
| Qualidade      | `assistente-avaliar` mede com perguntas reais; **nunca foi rodado com chave real**                                                                                                                                                |

## 4. Ferramentas e automação

- **Scripts** (`scripts/`, Node ≥ 22.18 direto em TypeScript, sem build):
  `migrate` (importa a base atual), `ingestao` (pasta de `.md`/`.html`/`.txt`
  para a fila de revisão, com vigília opcional), `estrutura`, `doc-sync` e
  `alt-texto` (sugestões por IA), `backup`, `verificar-links`,
  `cloudinary-limpeza`, `assistente`. Cada um tem o seu `README.md`.
- **Reuso:** os scripts importam as funções puras de `src/utils`; por isso os
  imports de valor levam a extensão `.ts`.
- **GitHub Actions:** `ci.yml` (lint, typecheck, testes, build e Emulator),
  `backup.yml` (exportação noturna do Firestore), `doc-sync.yml` e
  `ingestao.yml` (reutilizáveis), `verificar-links.yml` e
  `limpeza-cloudinary.yml`. **As agendadas dependem de segredos e nunca foram
  exercitadas de verdade.**
- **Comandos do Claude Code** (`.claude/commands`): `/extrair-kb` (extração e
  importação da base) e `/iniciar-kb` (sobe o sistema no localhost).

## 5. Qualidade e testes

| Camada                   | Ferramenta                             | Volume atual |
| ------------------------ | -------------------------------------- | ------------ |
| Unitários e de interface | Vitest + Testing Library (jsdom)       | cerca de 460 |
| Regras e scripts         | Emulator do Firestore + Vitest         | 222          |
| CI                       | lint, typecheck, format, build, testes | todo PR      |

Convenções: pt-BR na interface e na documentação; branches com nomes claros em
português; PR e merge só a pedido, com commit de mesclagem.

## 6. Decisões que valem lembrar

- **Sem backend para leitura e edição:** simples e barato, mas toda regra de
  acesso mora nas regras do Firestore.
- **Busca no navegador** (MiniSearch): rápida e sem custo de servidor, limitada
  pelo tamanho do índice (texto de até 16.000 caracteres por artigo).
- **Hierarquia ilimitada no banco, 4 níveis na interface** (BU, produto,
  subproduto, módulo).
- **Os índices de busca só têm artigos publicados:** o que está em revisão não
  aparece na busca nem na IA.

## 7. Riscos e pendências de arquitetura

1. **Projeto de produção do Firebase não existe**; tudo está no projeto de teste.
2. **Hospedagem do assistente de IA indefinida.** Opções: plano Blaze (Functions
   ou Cloud Run) ou outro servidor Node.
3. **Cota do plano Spark:** métricas e contagens por tela fazem muitas leituras.
4. **Segredos das Actions** (Cloudinary, Anthropic, Firebase) ainda não
   configurados.
5. **IA e imagens:** as imagens da base importada estão como "[Imagem não
   migrada]"; textos alternativos dependem da IA com chave.
6. **Agente local de pastas** (sincronizar pela tela sem Claude): só no
   roadmap.
7. **Perfil Editor e matriz de permissões:** desenhados no protótipo, não
   existem.
