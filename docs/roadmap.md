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

- [x] Cadastro de BUs (unidades de negócio) — tela admin "Unidades"
- [x] Cadastro de produtos vinculados às BUs — seletor no formulário do produto; `npm run estrutura` liga os já importados
- [x] Cadastro de subprodutos vinculados aos produtos (já existia: subblocos)
- [x] Relacionamento hierárquico e navegação entre níveis — Home agrupada por BU e breadcrumb com a BU
- [x] Categorias documentais (classificação funcional) — campo do artigo, filtro na página do bloco
- [ ] Estrutura inicial da KB — falta ligar o SmartShare-4 à BU "Process Solution" no Firebase `dev` e criar o SmartShare DI

Conclusão: navegar BU → Produto → Subproduto e ver as categorias disponíveis.

### Fase 2 — Gestão das origens documentais (semanas 3–6, sprints 2–3)

Objetivo: alimentar a KB por importação de arquivos externos e pelo editor
próprio. Fonte inicial: `C:\projetos_selbetti\smartshare-di\docs`.

- [x] Serviço de ingestão (identifica arquivos, extrai conteúdo, detecta
      alterações e duplicidades) — `npm run ingestao` (`scripts/ingestao`)
- [ ] Extração de `.md`, `.docx`, `.pdf`, `.txt` e `.html` — `.md`, `.txt` e
      `.html` feitos; `.docx` e `.pdf` ficaram de fora por decisão
- [x] Classificação (sugere categoria, produto/subproduto, conteúdo técnico ou
      misto) — por regras, sem IA; pastas viram subprodutos
- [x] Detecção de duplicidade e de alteração por hash de conteúdo
- [x] Controle de origem (rastreabilidade) — `origem` no artigo e coleção `fontes`
- [x] Fila de revisão: nada importado é publicado automaticamente — status
      "Em revisão", tela admin "Revisão" (aprovar um a um ou em lote, devolver a
      rascunho) e `--publicar` no importador para o comportamento antigo
- [x] Sincronização: arquivo novo → registro para revisão; alterado → revisão
      pendente (a versão publicada continua no ar); removido → análise de
      despublicação; sem alteração → não reprocessa; erro → registra e permite
      reprocessar — rodada manual com `npm run ingestao`; o monitoramento
      contínuo é da Fase 6
- [x] Editor próprio: criar/editar com modelos de documentação funcional
      (funcionalidade, configuração, processo, regra de negócio e em branco),
      imagens, tabelas e links, categorias, rascunho e envio para revisão.
      Os modelos ficam no código (`src/utils/modelos.ts`) e marcam o que falta
      escrever com "[Preencher: …]": enquanto houver, o artigo não vai para a
      revisão nem para o ar

Conclusão: documentos importados ou criados são classificados e vão para
revisão, sem publicação automática.

### Fase 3 — Pesquisa e navegação (semanas 7–8, sprint 4)

- [x] Pesquisa textual em título e conteúdo (já existia; MiniSearch no navegador)
- [x] Filtros por BU, produto, subproduto e categoria — tela de busca, na URL
- [x] Tela de resultados — caminho (BU › produto › subproduto), categoria e
      trecho destacado; só com filtro (sem texto) vira navegação
- [x] Visualização documental (já existia: página do artigo)
- [x] Documentações relacionadas — no fim do artigo, do mesmo produto
- [x] Navegação por categorias — tela "Categorias" (menu do topo)

Conclusão: achar uma documentação publicada sem saber o caminho nem o nome exato.

### Fase 4 — Governança editorial e publicação (semanas 9–10, sprint 5)

- [x] Ciclo de vida e status: rascunho, em revisão, aprovado, publicado,
      reprovado, arquivado — `src/utils/ciclo.ts` define as transições
- [x] Fluxo de revisão e comentários (pedido de ajustes) — reprovar exige
      comentário; conversa no editor e fila na tela "Revisão"
- [x] Aprovação e publicação — só um artigo aprovado é publicado
- [x] Versionamento (histórico de versões) — cada versão guarda quem aprovou e
      quem publicou; artigo publicado é alterado por uma "alteração pendente"
      e a versão no ar só muda quando ela é aprovada e publicada
- [x] Auditoria (responsáveis e decisões) — trilha no editor e tela "Auditoria"

Conclusão: somente documentos aprovados podem ser publicados, e versões
anteriormente publicadas permanecem disponíveis até que uma nova versão seja
aprovada.

Ainda não existe papel de "revisor" separado do admin: quem tem permissão de
admin pode escrever, aprovar e publicar. Separar quem escreve de quem aprova é
um passo futuro (precisa de um novo papel de usuário e de regras novas).

### Fase 5 — Inteligência artificial e RAG (semanas 11–14, sprints 6–7)

- [x] Integração segura com a API de IA — a chave fica num servidor
      (`npm run assistente`); o navegador manda só o login. Falta escolher onde
      hospedar em produção (precisa do plano Blaze ou de outro serviço)
- [x] Embeddings e banco vetorial — **trocado por outra técnica**: a Anthropic
      não tem API de embeddings, e a decisão foi manter o Firebase. A IA
      reformula a pergunta, o motor de busca acha candidatos e a IA escolhe os
      artigos. Embeddings ficam possíveis depois (muda só `recuperar.ts`)
- [x] Serviço de indexação dos documentos publicados — o índice de busca já é
      atualizado a cada publicação e só tem artigos publicados
- [x] RAG (recuperação de contexto)
- [x] Assistente (perguntas e respostas) com referências às fontes — tela
      "Assistente", citações [n] clicáveis
- [x] Filtros contextuais por BU, produto e subproduto (e categoria)
- [x] Controle de custos — cota por pessoa/dia, teto de gasto por dia e tela
      "Uso da IA" (gasto estimado, perguntas sem resposta, avaliações)

Conclusão: consultas funcionais respondidas com base na documentação publicada
e com referências verificáveis. A chamada real à API da Anthropic ainda não foi
exercitada (depende de chave): fazer o teste de qualidade da Fase 6.

### Fase 6 — Sincronização, estabilização e governança (semanas 15–16, sprint 8)

- [x] Monitorar diretórios e sincronização incremental — a opção `--observar`
      da ingestão (com `--gravar`) vigia a pasta e só sincroniza, e só consulta
      o Firebase, quando algo muda; a ingestão já processa só o que mudou, por hash
- [x] Integração com Git (se aplicável) — workflow reutilizável `ingestao.yml`,
      que grava repositório e commit (ainda não exercitado de verdade: depende
      de segredos e de um repositório de documentos)
- [x] Documentos removidos passam por revisão antes de despublicar — seção
      "Arquivo removido na origem" da tela Revisão (feito na Fase 2)
- [x] Painel de sincronização — tela "Sincronização" (menu admin)
- [x] Testar qualidade das respostas da IA — `npm run assistente-avaliar`
      (casos com fonte esperada, termos, recusa; relatório; não gasta a cota
      real). Falta montar o conjunto de perguntas reais e rodar com a chave
- [x] Testar permissões (segurança e isolamento) — matriz de todas as coleções
      contra 7 tipos de pessoa (`tests/rules/matriz-permissoes.test.ts`), que
      falha se uma coleção nova entrar nas regras sem linha na matriz
- [x] Revisar desempenho — carga inicial 39% menor (carga sob demanda das
      telas e do editor), índice de busca que não estoura o limite do
      Firestore e medições em `docs/desempenho.md`

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

| Plano do time                        | Hoje no código                                                          |
| ------------------------------------ | ----------------------------------------------------------------------- |
| BU → Produto → Subproduto            | Hierarquia livre de blocos (produto → subproduto → …), sem nível de BU  |
| Categorias documentais               | Campo do artigo, 4 categorias fixas                                     |
| Status em 6 estados                  | Existe: rascunho, em revisão, aprovado, publicado, reprovado, arquivado |
| Importar `.md/.docx/.pdf/.txt/.html` | `npm run ingestao` lê `.md`, `.html` e `.txt` (sem `.docx` e `.pdf`)    |
| Fila de revisão de importados        | Existe: a importação entra "em revisão" (`--publicar` publica direto)   |
| pgvector (Postgres)                  | Firestore; busca textual com MiniSearch, sem embeddings                 |
| Comentários na revisão               | Existe: no editor, com pedido de ajuste obrigatório ao reprovar         |
| Auditoria                            | Existe (`auditLog`)                                                     |

Decisão pendente: manter Firebase/Firestore (e buscar vetores noutro serviço)
ou mudar de banco antes da Fase 5.

## Pendências conhecidas

### Conteúdo (SmartShare 4)

- [x] Importar os 57 artigos só com texto no Firebase `dev`
- [ ] Configurar o Cloudinary (conta, preset sem assinatura, pasta fixa)
- [ ] Migrar as 211 imagens: rodar o importador sem `--sem-imagens` e com
      `--sobrescrever --publicar` (os 57 já estão no ar; fazer antes de editar os artigos à mão)
- [ ] Gerar e revisar os textos alternativos (`npm run alt-texto`), com a chave
      da API da Anthropic
- [ ] Decidir quais artigos são "técnicos" (`--tecnico "<regex>"` no adaptador)
- [ ] Decidir sobre o rodapé "Possui alguma dúvida ou sugestão?" (24 artigos)
- [ ] Conferir artigos com tabelas: o editor agora tem tabela, mas os 57 já
      importados foram gravados com a tabela achatada em texto; para recuperar,
      importar de novo o conteúdo (`--sobrescrever --publicar`, junto com as imagens)
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

### Aside e menus de administrador

- [x] Aside esquerda (Manual de produtos, Busca/consulta com IA), disponível
      para qualquer usuário, que escolhe o que ela mostra ("Configurar aside"
      dentro dela; botão no topo para reabrir quando oculta)
- [x] Métricas e Configurações visíveis só para admin; a aba Home foi removida e
      o Manual de produtos da aside abre a Home
- [x] Categorias e Assistente saíram do menu de cima (continuam na aside e pelas
      rotas)
- [x] Revisão, Sincronização e Auditoria agrupadas no módulo Governança, dentro
      de Configurações (saíram do menu de cima)
- [x] Manual de produtos mostra BU → produtos → subprodutos (subprodutos como
      links dentro do cartão do produto)
- [x] Chave de IA por usuário em Minhas preferências (só no navegador; só
      Anthropic por enquanto)
- [ ] Adaptador para outro fornecedor de IA (falta saber qual)
- [x] Menu de cima enxuto (Métricas e Configurações); Usuários e Uso da IA viraram
      o módulo Administração em Configurações; a escolha da aside foi para Minhas
      preferências; Sugestões e Unidades saíram do menu (rotas mantidas)
- [ ] Documentação de API na aside (falta definir a fonte)
- [x] Busca com IA: pergunta sem palavras comuns, sinônimos e índice com mais
      texto (4.000 → 16.000 caracteres); prompt para perguntas "o que é X"
- [x] Comando `/extrair-kb` (`.claude/commands/extrair-kb.md`) guia a
      extração e a importação em etapas, só gravando com confirmação
- [x] Comando `/iniciar-kb` sobe o sistema no localhost (`--assistente` também
      sobe o assistente de IA)
- [ ] Importar/escrever os artigos conceituais (ex.: "Gerenciamento de tipo de
      índice") e um glossário: sem o conteúdo, a IA só pode dizer que não achou
- [ ] Rodar `assistente-avaliar` com a chave real e perguntas de conceito

### Protótipo "Atlas Docs" (artboards do canvas)

- [x] Visual: paleta verde, grade de fundo, cartões e botões arredondados,
      cabeçalho (Métricas, Configurações, busca em pílula, nome e perfil),
      menu lateral "Documentação", botão flutuante do Assistente
- [x] Manual de produtos (Home): busca em destaque, cartões de BU com contagem
      de produtos e artigos, faixa de apresentação
- [x] Página da BU (`/u/:id`): produtos com subprodutos e contagens
- [x] Produto, Subproduto e Módulo (`/b/:id`): rótulo do nível, cartões com
      itens do nível seguinte e contagens, filtro por categoria em botões e
      ordenação (mais recentes, mais acessados, título)
- [x] Artigo: sumário "Neste artigo", relacionados, categoria e visualizações
      (sem autor, "Arquivar" e "Resumir com IA": não existem no sistema)
- [x] Editor: "← Voltar", seletor de local em cascata (BU, Produto, Subproduto,
      Módulo) para artigo novo, botões no novo estilo (sem tags nem
      pré-visualização lado a lado: o editor já é visual)
- [x] Busca: filtro de módulo, caminho completo do resultado e contagem "para
      “termo”, ordenados por relevância"
- [ ] Assistente: painel lateral em todas as telas
- [x] Métricas: filtro por BU, cartões (BUs, produtos, módulos documentados e
      cobertura, artigos, visualizações, desatualizados), artigos por BU, por
      produto e por mês
- [ ] Configurações: abas Estrutura, Usuários e Permissões
- Sem protótipo (feitos no mesmo estilo): Login, Minhas preferências, Revisão,
  Sincronização, Auditoria, Uso da IA, Unidades, Sugestões, tela de erro e de
  "sem acesso", tema escuro

### Backlog (do `PLAN.md`)

- [ ] Versões por versão do produto
- [ ] Botão "Este artigo foi útil?"
- [ ] Busca semântica
- [ ] Exportação em PDF

## Como atualizar este arquivo

1. Terminou uma tarefa? Troque `[ ]` por `[x]` e, se couber, anote a data.
2. Surgiu algo novo? Acrescente na seção certa.
3. Faça commit (peça ao Claude ou use `git add docs/roadmap.md && git commit`).
