# Roadmap

Lista viva do que falta fazer. Quem terminar uma tarefa marca aqui (`[x]`) e
faz commit. Um chat novo do Claude começa lendo este arquivo e o `CLAUDE.md`.

> **Se você já tem um roadmap próprio**, cole-o em "Roadmap do time" abaixo (ou
> peça ao Claude para incorporá-lo). A seção "Pendências conhecidas" foi
> escrita a partir do que ficou aberto no trabalho das fases 0 a 7.

## Roadmap do time

Plano do time para o **SmartShare KB**: 16 semanas, 6 fases, tendo o
SmartShare DI (BU Process Solution, produto SmartShare-4) como piloto. Marque
as caixas conforme as entregas forem concluídas.

> **Atenção:** este plano foi escrito antes do que já existe no código. Onde
> ele diverge (ex.: pgvector, BU como nível da hierarquia), veja a tabela
> "Diferenças em relação ao que está implementado" no fim desta seção.

### Fase 1 — Arquitetura funcional (semanas 1–2, sprint 1)

Objetivo: estrutura organizacional BU → Produto → Subproduto, com categorias de
documentação funcional (funcionalidades, configurações, processos, regras de
negócio).

- [ ] Cadastro de BUs (unidades de negócio)
- [ ] Cadastro de produtos vinculados às BUs
- [ ] Cadastro de subprodutos vinculados aos produtos
- [ ] Relacionamento hierárquico e navegação entre níveis
- [ ] Categorias documentais (classificação funcional)
- [ ] Estrutura inicial da KB

Conclusão: navegar BU → Produto → Subproduto e ver as categorias disponíveis.

### Fase 2 — Gestão das origens documentais (semanas 3–6, sprints 2–3)

Objetivo: alimentar a KB por importação de arquivos externos e pelo editor
próprio. Fonte inicial: `C:\projetos_selbetti\smartshare-di\docs`.

- [ ] Serviço de ingestão (identifica arquivos, extrai conteúdo, detecta
      alterações e duplicidades)
- [ ] Extração de `.md`, `.docx`, `.pdf`, `.txt` e `.html`
- [ ] Classificação (sugere categoria, produto/subproduto, conteúdo técnico ou
      misto)
- [ ] Detecção de duplicidade e de alteração por hash de conteúdo
- [ ] Controle de origem (rastreabilidade)
- [ ] Fila de revisão: nada importado é publicado automaticamente
- [ ] Sincronização: arquivo novo → registro para revisão; alterado → revisão
      pendente (a versão publicada continua no ar); removido → análise de
      despublicação; sem alteração → não reprocessa; erro → registra e permite
      reprocessar
- [ ] Editor próprio: criar/editar, modelos de documentação funcional, imagens,
      tabelas e links, categorias, rascunho e envio para revisão

Conclusão: documentos importados ou criados são classificados e vão para
revisão, sem publicação automática.

### Fase 3 — Pesquisa e navegação (semanas 7–8, sprint 4)

- [ ] Pesquisa textual em título e conteúdo
- [ ] Filtros por BU, produto, subproduto e categoria
- [ ] Tela de resultados
- [ ] Visualização documental
- [ ] Documentações relacionadas
- [ ] Navegação por categorias

Conclusão: achar uma documentação publicada sem saber o caminho nem o nome exato.

### Fase 4 — Governança editorial e publicação (semanas 9–10, sprint 5)

- [ ] Ciclo de vida e status: rascunho, em revisão, aprovado, publicado,
      reprovado, arquivado
- [ ] Fluxo de revisão e comentários (pedido de ajustes)
- [ ] Aprovação e publicação
- [ ] Versionamento (histórico de versões)
- [ ] Auditoria (responsáveis e decisões)

Conclusão: só documento aprovado é publicado; a versão publicada anterior
continua disponível até a nova ser aprovada.

### Fase 5 — Inteligência artificial e RAG (semanas 11–14, sprints 6–7)

- [ ] Integração segura com a API de IA
- [ ] Embeddings e banco vetorial (plano original: pgvector)
- [ ] Serviço de indexação dos documentos publicados
- [ ] RAG (recuperação de contexto)
- [ ] Assistente (perguntas e respostas) com referências às fontes
- [ ] Filtros contextuais por BU, produto e subproduto
- [ ] Controle de custos

Conclusão: consultas funcionais respondidas com base na documentação publicada
e com referências verificáveis.

### Fase 6 — Sincronização, estabilização e governança (semanas 15–16, sprint 8)

- [ ] Monitorar diretórios e sincronização incremental
- [ ] Integração com Git (se aplicável)
- [ ] Documentos removidos passam por revisão antes de despublicar
- [ ] Painel de sincronização
- [ ] Testar qualidade das respostas da IA
- [ ] Testar permissões (segurança e isolamento)
- [ ] Revisar desempenho

Conclusão: alterações na origem são detectadas e vão para revisão, sem
publicação indevida. O SmartShare DI é o piloto.

### Marcos

| Marco | Semana | Resultado                                           |
| ----- | ------ | --------------------------------------------------- |
| 1     | 2      | Estrutura organizacional pronta                     |
| 2     | 6      | Importação, editor, classificação e fila de revisão |
| 3     | 10     | KB publicada e pesquisável                          |
| 4     | 14     | Assistente de IA com referências                    |
| 5     | 16     | Primeira versão estabilizada                        |

### Cuidados de execução

1. A aprovação já vale desde a Fase 2: importado fica pendente, nunca publicado.
2. Pesquisa e IA usam só conteúdo autorizado (rascunho e em revisão ficam fora
   do índice oficial).
3. Preparar a sincronização na Fase 2 evita retrabalho na Fase 6.

### Diferenças em relação ao que está implementado

| Plano do time                        | Hoje no código                                                         |
| ------------------------------------ | ---------------------------------------------------------------------- |
| BU → Produto → Subproduto            | Hierarquia livre de blocos (produto → subproduto → …), sem nível de BU |
| Categorias documentais               | Não existe                                                             |
| Status em 6 estados                  | Rascunho/publicado e versões; sugestões da IA com aprovação do admin   |
| Importar `.md/.docx/.pdf/.txt/.html` | Importador de exportação neutra (`.md`/`.html`) e adaptador SmartShare |
| Fila de revisão de importados        | Importação publica direto (com `--sem-imagens`, etc.)                  |
| pgvector (Postgres)                  | Firestore; busca textual com MiniSearch, sem embeddings                |
| Comentários na revisão               | Não existe                                                             |
| Auditoria                            | Existe (`auditLog`)                                                    |

Decisão pendente: manter Firebase/Firestore (e buscar vetores noutro serviço)
ou mudar de banco antes da Fase 5.

## Pendências conhecidas

### Conteúdo (SmartShare 4)

- [x] Importar os 57 artigos só com texto no Firebase `dev`
- [ ] Configurar o Cloudinary (conta, preset sem assinatura, pasta fixa)
- [ ] Migrar as 211 imagens: rodar o importador sem `--sem-imagens` e com
      `--sobrescrever` (fazer antes de editar os artigos à mão)
- [ ] Gerar e revisar os textos alternativos (`npm run alt-texto`), com a chave
      da API da Anthropic
- [ ] Decidir quais artigos são "técnicos" (`--tecnico "<regex>"` no adaptador)
- [ ] Decidir sobre o rodapé "Possui alguma dúvida ou sugestão?" (24 artigos)
- [ ] Conferir artigos com tabelas (o editor não tem tabela; viram texto)
- [ ] Importar o produto **SmartShare** (clássico), se for entrar no sistema

### Ambientes e segurança

- [ ] Criar o projeto Firebase de produção (`docs-hub-prod`) e repetir a
      configuração do `dev`
- [ ] Publicar regras e índices no `prod`
- [ ] Revisar a restrição da chave de API web (Google Cloud → Credenciais)
- [ ] Criar as contas de serviço (leitura e escrita) por ambiente
- [ ] Apagar a chave `service-account-dev.json` quando não for mais usada
- [ ] Publicar o sistema (hospedagem) e adicionar o domínio em Authentication →
      Domínios autorizados

### Automações do GitHub (ver o checklist no `README.md`)

- [ ] Segredos e variáveis: `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`
- [ ] Backup noturno: `BACKUP_PASSPHRASE` (guardar a senha **fora** do GitHub)
- [ ] Limpeza do Cloudinary: chaves e `CLOUDINARY_LIMPEZA_APAGAR` só depois de
      semanas de relatório confiável
- [ ] Verificar links semanalmente
- [ ] Testar uma restauração de backup no `dev`

### Sugestões por IA (`doc-sync`)

- [ ] Definir onde ficam os arquivos `.md` de regras (repositório e pasta) e
      quem os mantém
- [ ] Configurar `ANTHROPIC_API_KEY` e a conta de serviço de escrita
- [ ] Testar com um arquivo de regras real em um artigo do `dev`

### Operação

- [ ] Criar os usuários reais pela tela "Usuários" e definir produtos permitidos
- [ ] Período de convivência com a ferramenta antiga (somente leitura) e
      desligamento
- [ ] Apagar as branches antigas (`fase-0-setup` já está contida na padrão; as
      `fase-1` a `fase-4` têm commits próprios: **conferir antes**)
- [ ] Decidir se a branch padrão passa a se chamar `principal`

### Backlog (do `PLAN.md`)

- [ ] Versões por versão do produto
- [ ] Botão "Este artigo foi útil?"
- [ ] Busca semântica
- [ ] Exportação em PDF

## Como atualizar este arquivo

1. Terminou uma tarefa? Troque `[ ]` por `[x]` e, se couber, anote a data.
2. Surgiu algo novo? Acrescente na seção certa.
3. Faça commit (peça ao Claude ou use `git add docs/roadmap.md && git commit`).
