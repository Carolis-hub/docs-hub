# Estudo técnico: consulta inteligente à Base de Conhecimento

Estudo de novembro de 2026 sobre como implementar a consulta à KB por produto,
para leitores técnicos e não técnicos, com vários usuários ao mesmo tempo.

**Como ler os números:** as medidas de busca vêm de `docs/desempenho.md`
(artigos sintéticos); as contas de custo e de latência são **estimativas por
inspeção do código e pela tabela de preços**, não medições. A chamada real à
IA nunca foi exercitada neste projeto, então toda afirmação sobre qualidade de
resposta é hipótese até a avaliação rodar.

## Resumo da recomendação

1. **Não trocar de arquitetura.** O sistema já tem as duas peças certas: busca
   por palavras no navegador e um assistente que responde só com base nos
   artigos, com citação. Falta ajustá-las, medi-las e colocá-las em produção.
2. **Duas formas de consulta, com papéis diferentes.** A busca por palavras é
   o caminho padrão (instantânea, sem custo, sem risco de invenção). A
   pergunta em linguagem natural é o segundo passo, para quando a pessoa não
   sabe o termo ou quer um passo a passo montado.
3. **Produto obrigatório na consulta.** Hoje o produto é um filtro opcional;
   deve passar a ser o contexto da consulta, herdado da tela em que a pessoa
   está.
4. **Recuperar por trecho, não por artigo inteiro.** É a mudança que mais
   deve melhorar a resposta e não depende de embeddings.
5. **Embeddings e banco vetorial: só se a medição pedir.** Com o volume atual
   (57 artigos) e o previsto (centenas a poucos milhares por produto), não há
   evidência de que sejam necessários. O gatilho e o caminho de adoção estão
   descritos abaixo, e a troca fica isolada em um arquivo.

## 1. Diagnóstico

### O que existe hoje

| Peça                   | Como funciona                                                                                                                                                                          | Onde                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Busca por palavras     | MiniSearch no navegador, sobre um índice por produto (`searchIndex/{produto}`), carregado uma vez por sessão. Prefixo, tolerância a erro de digitação, título com peso 4               | `src/utils/searchEngine.ts`       |
| Segmentação            | Filtros de BU, produto, subproduto, módulo e categoria, na URL                                                                                                                         | `src/pages/SearchPage.tsx`        |
| Assistente (perguntas) | Servidor Node. A IA reformula a pergunta em 3 a 5 consultas, o mesmo motor de busca acha candidatos (fusão por posição, RRF), a IA escolhe até 5 artigos e a IA responde citando `[n]` | `scripts/assistente/`             |
| Acesso                 | Navegador: regras do Firestore. Servidor: conferência em código (publicado, produto permitido, técnico só para quem pode)                                                              | `firestore.rules`, `recuperar.ts` |
| Controle de gasto      | 30 perguntas por pessoa por dia, teto diário em dólar, registro de cada pergunta                                                                                                       | `responder.ts`                    |
| Medição                | `assistente-avaliar` (casos com fonte esperada, termos, recusa); contador de buscas sem resultado (`searchMisses`); avaliação útil/ruim por resposta                                   | `scripts/assistente/avaliar.ts`   |

### Requisitos que pesam na decisão

- **Volume pequeno.** 1 produto e 57 artigos importados; a expectativa é de
  dezenas de produtos com centenas de artigos cada. Nessa escala, busca por
  palavras roda em milissegundos (7 ms por busca com 3.000 artigos).
- **Público misto.** O leitor técnico sabe o nome da tela e quer chegar ao
  artigo. O não técnico descreve o problema com as próprias palavras, que
  muitas vezes não são as do artigo.
- **Conteúdo com controle de acesso** em três eixos: produto permitido, artigo
  publicado e público (usuário ou técnico).
- **Custo baixo e pouca operação.** Plano gratuito do Firebase, sem backend
  próprio para o dia a dia, time pequeno.
- **Confiabilidade acima de fluidez.** Documentação de produto: uma resposta
  inventada (um campo ou passo que não existe) custa mais que um "não achei".

### Lacunas encontradas

| #   | Lacuna                                                                                                                                                                                                                                                  | Efeito                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| L1  | **Produto é opcional.** Sem filtro, busca e assistente consultam todos os produtos permitidos                                                                                                                                                           | Respostas misturam produtos com telas de nome parecido; contraria o requisito           |
| L2  | **Recuperação por artigo inteiro, com corte.** O índice guarda até 16.000 caracteres por artigo (menos quando o subproduto é grande) e a IA lê só os primeiros 6.000 de cada fonte                                                                      | Se a resposta está no fim de um artigo longo, a IA não a vê e diz que não achou         |
| L3  | **O servidor relê e remonta o índice a cada pergunta** (10 a 40 leituras no Firestore, mais o tempo de montar o motor)                                                                                                                                  | Latência e cota: 100 pessoas no limite diário passam das 50 mil leituras do plano Spark |
| L4  | **Até 3 chamadas de IA em sequência, sem transmissão parcial**, todas no modelo mais caro por padrão                                                                                                                                                    | A pessoa espera a resposta inteira sem ver nada; custo maior que o necessário           |
| L5  | **Sem hospedagem.** O assistente só roda no computador de quem o inicia                                                                                                                                                                                 | Não há consulta com IA para os leitores                                                 |
| L6  | **Qualidade nunca medida.** Não há conjunto de perguntas reais nem execução com chave                                                                                                                                                                   | Qualquer decisão sobre embeddings ou modelo seria no escuro                             |
| L7  | **Sinônimos fixos no código** (8 grupos, do vocabulário do SmartShare) e só no assistente                                                                                                                                                               | A busca comum não acha "apagar" quando o artigo diz "excluir"; não escala por produto   |
| L8  | **Texto técnico no índice do leitor comum.** A regra de `searchIndex/{produto}` libera o documento inteiro para quem vê o produto, e o filtro de artigos técnicos é feito no navegador. Constatado pela leitura do código; não testei contra o Emulator | Quem não tem `verTecnico` não vê o artigo na tela, mas o texto chega ao navegador dele  |

L8 é um problema de controle de acesso que existe independentemente deste
estudo e deve ser corrigido antes de qualquer conteúdo técnico real entrar.

## 2. Alternativas técnicas

### Estratégias de recuperação

| Estratégia                                                   | Vantagens                                                                                                                              | Desvantagens e limites                                                                                                                                                       | Complexidade     | Custo                                     |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------- |
| **A. Busca por palavras** (o que existe)                     | Instantânea, no navegador, sem servidor; resultado explicável (termo destacado); ótima para nomes de tela, códigos e mensagens de erro | Depende de a pessoa usar a palavra do artigo; não entende a pergunta; o índice inteiro é baixado (cerca de 4 KB por artigo longo)                                            | Nenhuma (pronta) | Zero                                      |
| **B. Busca semântica** (embeddings)                          | Acha por significado, mesmo com outras palavras; funciona bem com perguntas longas                                                     | Fraca em termo exato, sigla e código; exige servidor para vetorizar a consulta; exige fornecedor de embeddings (a Anthropic não oferece); reindexar tudo ao trocar de modelo | Média            | Baixo em uso; exige plano pago e servidor |
| **C. Híbrida** (A + B, fusão das listas)                     | Cobre termo exato e significado; é o padrão de mercado para documentação                                                               | Soma a operação das duas; o ganho sobre A só aparece se houver muito desencontro de vocabulário                                                                              | Média a alta     | Igual a B                                 |
| **D. Palavras + reformulação por IA** (o assistente de hoje) | Resolve desencontro de vocabulário sem vetores nem banco novo; usa o índice que já existe                                              | Uma chamada de IA a mais por pergunta; só vale para a pergunta em linguagem natural, não para a busca comum                                                                  | Nenhuma (pronta) | Centavos de dólar por pergunta, ou menos  |

### Forma da resposta

| Forma                                           | Vantagens                                                                            | Desvantagens e limites                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Lista de artigos** (com trecho destacado)     | Rápida, barata, sem invenção; a pessoa lê a fonte                                    | A pessoa precisa abrir e procurar dentro do artigo                                                  |
| **Resposta escrita pela IA com citações** (RAG) | Responde direto, junta trechos de vários artigos, adapta a linguagem ao leitor leigo | Custo por pergunta, segundos de espera, risco de erro mesmo com citação, depende de serviço externo |
| **Agente** (a IA decide buscar várias vezes)    | Lida com perguntas compostas                                                         | Custo e tempo imprevisíveis; desnecessário para perguntas de documentação. Não recomendado          |

### Onde guardar vetores, se um dia forem necessários

| Opção                                                | Aplicabilidade                                                                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vetores em memória no servidor do assistente**     | Suficiente até dezenas de milhares de trechos por produto (comparação direta leva milissegundos). Os vetores ficam em documentos do Firestore e sobem para a memória junto com o índice    |
| **Busca vetorial nativa do Firestore**               | Mantém um banco só e aceita filtro por produto na mesma consulta. Disponibilidade no plano e limites precisam ser confirmados na documentação do Firebase antes de adotar                  |
| **Banco vetorial dedicado ou Postgres com pgvector** | Só se justifica com centenas de milhares de trechos ou filtros complexos. Cria um segundo banco, uma segunda cópia do controle de acesso e uma sincronização a manter. **Não recomendado** |

### Por que não começar por embeddings

- O problema que eles resolvem (vocabulário diferente) já é atacado pela
  reformulação da pergunta, e ainda não se sabe se sobra desencontro.
- A lacuna que mais deve derrubar respostas hoje é L2 (trecho fora do corte),
  que embeddings não resolvem sozinhos e que a divisão em trechos resolve
  sem eles.
- Eles trazem um fornecedor novo, um servidor obrigatório até para a busca
  comum e um passo de reindexação a cada publicação.

Isso é uma hipótese a confirmar com a avaliação da Fase 1, não uma certeza.

## 3. Recomendação

**Busca por palavras como padrão e pergunta com IA sob demanda, as duas
presas a um produto, com recuperação por trecho; busca híbrida como evolução
condicionada à medição.**

Justificativa:

- **Atende os dois públicos.** O técnico resolve na busca; o leigo, na
  pergunta. Oferecer a busca primeiro evita gastar IA com o que um título
  resolve.
- **Escala onde precisa.** A busca roda na máquina de cada pessoa: mil
  usuários simultâneos não custam nada ao servidor. Só as perguntas com IA
  passam pelo servidor, e elas têm cota.
- **Confiável.** A busca não inventa. A IA só recebe artigos publicados e
  permitidos, é instruída a recusar quando não acha e tem as citações
  conferidas.
- **Evolui sem refazer.** A recuperação está isolada em
  `scripts/assistente/recuperar.ts` e a fusão por posição já aceita uma
  segunda lista. Acrescentar vetores é somar uma fonte de candidatos, não
  trocar a arquitetura.

**Critério para adotar a busca híbrida (Fase 4):** depois da divisão em
trechos, se mais de cerca de 15% das perguntas do conjunto de avaliação
falharem porque a fonte esperada não ficou entre os candidatos, e a causa for
vocabulário (não conteúdo ausente), vale implementar. O número é um ponto de
partida a calibrar com o time.

**Modelo de IA:** a escolha deve sair da avaliação, não de preferência. O
padrão do código é o Claude Opus 5.5 nas três etapas. As duas etapas de busca
(reformular e escolher) são tarefas simples e são as candidatas naturais a um
modelo menor (`ASSISTENTE_MODELO_BUSCA`, já existe). Para a etapa de resposta,
rodar o mesmo conjunto com Opus 5.5, Sonnet 5.5 e Haiku 5.5 e decidir pelo mais
barato que mantiver a taxa de acerto e de recusa correta.

## 4. Arquitetura proposta

```
 Navegador (React)
 ┌──────────────────────────────────────────────────────────────────┐
 │ Contexto de produto (da tela ou escolhido; obrigatório)          │
 │                                                                  │
 │ Busca por palavras ── MiniSearch ── índice do produto (Firestore)│
 │        │ poucos ou nenhum resultado                              │
 │        ▼                                                         │
 │ "Perguntar ao assistente" ───────────────┐                       │
 └──────────────────────────────────────────┼───────────────────────┘
                                            │ pergunta + produto + login
                                            ▼
 Servidor do assistente (Node, sem estado, várias instâncias)
 ┌──────────────────────────────────────────────────────────────────┐
 │ 1. Login, perfil, cota e teto de gasto                           │
 │ 2. Escopo: produto pedido ∩ produtos permitidos                  │
 │ 3. Índice de trechos do produto (em memória, com validade)       │
 │ 4. Reformular (IA, modelo menor) ── busca por palavras ── fusão  │
 │    [futuro: + busca por vetores na mesma fusão]                  │
 │ 5. Escolher trechos (IA, modelo menor)                           │
 │ 6. Conferir acesso de novo e carregar os trechos                 │
 │ 7. Responder com citações (IA), transmitindo o texto aos poucos  │
 │ 8. Validar citações, registrar uso e custo                       │
 └───────────────┬──────────────────────────────┬───────────────────┘
                 ▼                              ▼
          Firestore (Admin SDK)         API da Anthropic
```

### Componentes e mudanças

| Componente            | Mudança                                                                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contexto de produto   | Busca e assistente abrem já no produto da tela atual; fora de um produto, a pessoa escolhe antes de consultar (quem só tem um produto permitido nem vê a escolha). Subproduto e módulo continuam como refinamento opcional                                  |
| Índice de trechos     | Ao publicar, o artigo é dividido pelos títulos (1 a 3) em trechos de até cerca de 2.000 caracteres, cada um com o caminho ("Artigo › Seção"). Gravado por produto, fora do índice que o navegador baixa. Feito dentro de `transitar()`, como o índice atual |
| Separação por público | Trechos e itens de artigos técnicos em documentos separados, com regra que exige `verTecnico` (corrige L8)                                                                                                                                                  |
| Cache no servidor     | O índice de cada produto fica em memória; a cada pergunta lê-se só um carimbo de versão (1 leitura) para saber se mudou                                                                                                                                     |
| Resposta transmitida  | O texto aparece enquanto é escrito. Exige trocar a saída estruturada da etapa de resposta por texto com marcadores `[n]` (a validação das citações continua igual)                                                                                          |
| Sinônimos             | Saem do código e viram um glossário por produto, editável por admin, usado também na busca comum                                                                                                                                                            |
| Hospedagem            | Cloud Run no mesmo projeto do Firebase (região `southamerica-east1`), com a chave da Anthropic no gerenciador de segredos. Exige o plano Blaze. O servidor já não guarda estado, então pode ter várias instâncias                                           |
| Evolução (vetores)    | Se o critério da Seção 3 for atingido: um vetor por trecho, gravado junto do trecho; a consulta por vetores entra como mais uma lista na fusão que já existe                                                                                                |

### Segmentação por produto e hierarquia

- O produto é parte do pedido e o servidor calcula `produto pedido ∩ produtos
permitidos`. Um filtro nunca amplia o acesso (já é assim).
- O índice é **físico por produto** (um documento ou conjunto de documentos
  por produto). Uma consulta a um produto nunca carrega texto de outro, o que
  é mais forte que filtrar depois de buscar.
- Cada trecho carrega `blockId`; subproduto e módulo viram um conjunto de
  blocos permitidos (`comDescendentes`, já existe).
- Com vetores, o mesmo desenho vale: vetores gravados por produto.

### Segurança e confiabilidade

| Risco                                  | Controle                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Resposta inventada                     | A IA só recebe trechos recuperados; instrução de recusar; sem trecho relevante a IA de resposta nem é chamada; conjunto de avaliação com perguntas sem resposta (cerca de 20%) |
| Fonte não rastreável                   | Citação `[n]` validada contra o que foi enviado; com trechos, o link leva à seção do artigo, não só ao artigo                                                                  |
| Vazamento entre produtos ou de técnico | Índice por produto; conferência repetida em `carregarFontes`; correção de L8; matriz de permissões estendida às coleções novas                                                 |
| Instrução escondida num artigo         | O conteúdo vai marcado como material de consulta (já é assim); a IA não tem ferramentas nem poder de escrita, então o pior caso é uma resposta ruim                            |
| Conteúdo desatualizado                 | O índice só tem publicados e é atualizado na publicação; a resposta pode mostrar a data da última revisão da fonte                                                             |
| Privacidade                            | O registro guarda o texto das perguntas (só admin lê). Definir prazo de retenção e avisar na tela que a pergunta é enviada a um serviço externo                                |

### Desempenho e concorrência

| Caminho               | Hoje (estimado)                                    | Proposto                                                                                      |
| --------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Busca por palavras    | Menos de 10 ms por busca; o peso é baixar o índice | Baixar só o índice do produto em contexto                                                     |
| Pergunta com IA       | Três chamadas em sequência, resposta só no fim     | Primeiro texto em poucos segundos, com transmissão parcial e modelo menor nas etapas de busca |
| Leituras por pergunta | 10 a 40                                            | Cerca de 3 a 8 (carimbo, trechos escolhidos, contadores)                                      |

Pontos de concorrência a observar:

- **Limite de requisições da conta na Anthropic.** É o teto real de perguntas
  simultâneas. O SDK já tenta de novo em caso de limite; a tela precisa de uma
  mensagem clara de "muita gente perguntando, tente em instantes".
- **Contador global do dia.** Toda pergunta grava no mesmo documento
  (`g_{dia}`) dentro de uma transação. Com dezenas de perguntas no mesmo
  segundo haverá repetição de transação. Se aparecer, dividir o contador em
  partes.
- **Memória do servidor.** O índice em memória cresce com o número de
  produtos; descartar os menos usados.

### Custos (estimativas)

Preços por milhão de tokens (entrada / saída): Opus 5.5 US$ 4 / 20; Sonnet 5.5
US$ 2 / 10; Haiku 5.5 US$ 0,10 / 0,50. Uma resposta consome cerca de 10 mil
tokens de entrada (os trechos) e mil de saída.

| Modelo da resposta | Por pergunta (aprox.) | 11 mil perguntas por mês\* |
| ------------------ | --------------------- | -------------------------- |
| Opus 5.5           | US$ 0,06              | US$ 660                    |
| Sonnet 5.5         | US$ 0,03              | US$ 330                    |
| Haiku 5.5          | US$ 0,002             | US$ 17                     |

\* 100 pessoas, 5 perguntas por dia útil. As etapas de busca somam cerca de
US$ 0,01 a 0,02 por pergunta no Opus 5.5 e menos de um décimo de centavo no
Haiku 5.5. Recuperar por trecho tende a reduzir os tokens de entrada (trechos
de 2.000 caracteres em vez de artigos de 6.000).

Outros custos:

- **Hospedagem (Cloud Run):** paga por uso e tem faixa gratuita; para este
  volume a ordem é de poucos dólares por mês. Confirmar na calculadora do
  Google.
- **Firestore:** no plano Blaze as cotas gratuitas diárias continuam valendo;
  o excedente é cobrado por operação.
- **Embeddings (se adotados):** vetorizar o acervo inteiro custa pouco perto
  das respostas; o custo real é de operação (reindexar, mais um fornecedor).
  Confirmar o preço com o fornecedor escolhido.
- **Cache de prompt:** pouco aproveitável aqui, porque os trechos mudam a cada
  pergunta e as instruções fixas são curtas.

O teto diário atual (US$ 10) limita o gasto a cerca de US$ 300 por mês, o que
no Opus 5.5 significa perto de 150 perguntas por dia para todos.

### Manutenção

- **Publicar um artigo** atualiza o índice de palavras e os trechos na mesma
  operação. Não há tarefa agendada de reindexação.
- **Reindexação completa** só ao mudar a regra de divisão em trechos (ou o
  modelo de embeddings, se houver): um comando por produto, idempotente.
- **Qualidade:** rodar `assistente-avaliar` a cada mudança de modelo, de
  instrução ou de limite; revisar todo mês as buscas sem resultado e as
  respostas marcadas como ruins, que viram artigos novos, sinônimos ou casos
  de avaliação.
- **Modelos:** o identificador do modelo é configuração; trocar exige só
  rodar a avaliação antes.

## 5. Fluxo de utilização

1. **Contexto.** A pessoa está na tela de um produto, subproduto, módulo ou
   artigo: a consulta já vale para aquele produto, mostrado como etiqueta
   ("Buscando em: SmartShare 4") que pode ser trocada. Na Home, a caixa de
   busca pede o produto primeiro.
2. **Digita.** Uma caixa só. Enquanto digita, aparecem artigos do produto, com
   o caminho (Subproduto › Módulo) e o trecho destacado.
3. **Refina, se quiser,** por subproduto, módulo e categoria.
4. **Pergunta.** Se o texto tem cara de pergunta, ou se a busca trouxe pouco,
   aparece "Perguntar ao assistente sobre isto", que leva o texto e o produto.
   O assistente continua acessível pelo botão flutuante.
5. **Resposta.** O texto aparece aos poucos, em linguagem simples, com passos
   numerados e citações `[1]`. Abaixo, as fontes com link para a seção exata.
6. **Sem resposta.** O assistente diz que a documentação daquele produto não
   traz a informação, sugere termos e mostra os artigos mais próximos. A
   pergunta entra no relatório de lacunas.
7. **Avaliação.** Útil ou não útil, com um clique.
8. **Continuação.** Perguntas seguintes mantêm o produto e o histórico curto
   da conversa; trocar de produto começa uma conversa nova.

## 6. Roadmap

| Fase                | Entregáveis                                                                                                                                                                                                    | Depende de                                                   | Prioridade                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------- |
| **0. Medir**        | Conjunto de 30 a 50 perguntas reais do suporte (com cerca de 20% sem resposta na documentação); primeira execução do `assistente-avaliar` com chave real; latência e custo medidos por etapa                   | Chave da Anthropic; artigos conceituais e imagens importados | Alta: desbloqueia todas as decisões |
| **1. Base correta** | Produto obrigatório na busca e no assistente; separação do conteúdo técnico no índice (L8); recuperação por trecho com link para a seção; nova rodada de avaliação para comparar                               | Fase 0                                                       | Alta                                |
| **2. Produção**     | Projeto de produção e plano Blaze; assistente no Cloud Run; cache do índice no servidor; resposta transmitida aos poucos; modelo por etapa definido pela avaliação; mensagens de limite e de indisponibilidade | Fase 1; decisão de orçamento                                 | Alta                                |
| **3. Experiência**  | Caixa única (busca que oferece a pergunta); glossário de sinônimos por produto; relatório de lacunas juntando buscas sem resultado e perguntas sem resposta; data de revisão nas fontes                        | Fase 2                                                       | Média                               |
| **4. Híbrida**      | Vetores por trecho e segunda lista na fusão; escolha do fornecedor de embeddings; comando de reindexação. **Só se o critério da Seção 3 for atingido**                                                         | Fases 1 e 2; medição que justifique                          | Condicional                         |
| **5. Evolução**     | Perguntas seguindo o contexto do artigo aberto; resumo de artigo; ingestão de `.docx` e `.pdf`; citação com o trecho exato destacado no artigo                                                                 | Uso real                                                     | Baixa                               |

## 7. MVP

**Objetivo:** provar, com um produto e um grupo pequeno, que a consulta por
produto responde bem e a um custo aceitável, antes de investir em produção.

Dentro do MVP:

- Um produto (SmartShare 4), com os artigos conceituais e as imagens importados.
- Produto obrigatório na busca e no assistente.
- Recuperação por trecho.
- Conjunto de avaliação e duas execuções (antes e depois dos trechos).
- Assistente hospedado de forma simples para 5 a 10 pessoas do suporte, por
  duas semanas, com a cota e o teto atuais.

Fora do MVP: embeddings, banco vetorial, caixa única, glossário editável,
resposta transmitida aos poucos, vários produtos, ingestão de `.docx` e `.pdf`.

Critérios de aprovação (pontos de partida, a ajustar com o time):

| Medida                                           | Meta                         |
| ------------------------------------------------ | ---------------------------- |
| Casos aprovados no conjunto de avaliação         | 80% ou mais                  |
| Perguntas sem resposta na documentação recusadas | 95% ou mais                  |
| Respostas com citação apontando para fonte real  | 100%                         |
| Avaliações "útil" no piloto                      | 70% ou mais                  |
| Custo médio por pergunta                         | Dentro do orçamento definido |
| Tempo até a resposta completa (mediana)          | Medir; referência de 15 s    |

Se a taxa de acerto ficar abaixo da meta por falha de recuperação causada por
vocabulário, a Fase 4 sobe de prioridade. Se ficar abaixo por falta de
conteúdo, o trabalho é de documentação, não de tecnologia.

## 8. Riscos e pontos de atenção

| Risco                                                                                               | Mitigação                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Conteúdo é o gargalo, não a tecnologia.** Sem artigo conceitual, a IA só pode dizer que não achou | Relatório de lacunas alimenta a pauta de documentação; importar o que falta antes do piloto                                                                      |
| Nada da IA foi exercitado com chave real                                                            | Fase 0 antes de qualquer outra decisão                                                                                                                           |
| Imagens não migradas (211 marcadores) e tabelas achatadas nos 57 artigos                            | Reimportar com imagens antes do piloto; a IA não lê imagem, então passos que só existem em captura de tela ficam invisíveis para ela (o texto alternativo ajuda) |
| Divisão em trechos ruim (corta um passo a passo ao meio)                                            | Dividir por título, nunca no meio de lista ou tabela; incluir o título do artigo e da seção em cada trecho; conferir com a avaliação                             |
| Vazamento de conteúdo técnico (L8) ou entre produtos                                                | Corrigir antes de conteúdo técnico real; testes de regras e de `carregarFontes` para as coleções novas                                                           |
| Custo fora de controle                                                                              | Cota por pessoa e teto diário (já existem); busca como caminho padrão; alerta de orçamento na conta                                                              |
| Dependência de um fornecedor de IA                                                                  | A busca funciona sem IA; a interface do provedor já é isolada (`ia.ts`); modelo é configuração                                                                   |
| Limite do documento do Firestore (1 MiB) com trechos                                                | Mesma divisão por subproduto do índice atual; trechos em documentos próprios                                                                                     |
| Confiança excessiva na resposta                                                                     | Fontes sempre visíveis; aviso de que a resposta é gerada e deve ser conferida no artigo; avaliação por clique                                                    |
| Plano Blaze e projeto de produção ainda não existem                                                 | Decisão de orçamento no início da Fase 2; alertas de gasto no Google Cloud                                                                                       |
| Privacidade das perguntas (LGPD)                                                                    | Prazo de retenção do registro; aviso na tela; não registrar a chave pessoal (já é assim)                                                                         |

## Decisões que dependem do time

1. Quem monta o conjunto de perguntas reais e quando a chave da Anthropic fica
   disponível para a Fase 0.
2. Orçamento mensal de IA e de hospedagem (define modelo e cota).
3. Se o produto obrigatório vale também para admins (sugestão: sim, com a
   opção "todos os produtos" só para eles).
4. Prazo de retenção do texto das perguntas.
