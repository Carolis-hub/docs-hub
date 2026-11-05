# Estimativa de consumo das cotas do Spark

Limites diários do plano Spark do Firestore: **50 mil leituras** e **20 mil
gravações** (mais 20 mil exclusões e 1 GiB de armazenamento). As contas abaixo
são **estimativas por inspeção do código**, não medições: meça no `dev` antes
de depender delas.

## Custo por ação do leitor

| Ação                                 | Leituras                           | Gravações                    |
| ------------------------------------ | ---------------------------------- | ---------------------------- |
| Entrar (perfil `users/{uid}`)        | 1                                  | 0                            |
| Carregar o índice de busca na sessão | produtos permitidos × (1 + partes) | 0                            |
| Home (cards de produtos)             | 1 por produto permitido            | 0                            |
| Página de bloco                      | 1 + ancestrais + filhos + artigos  | 0                            |
| Abrir um artigo                      | 1 + ancestrais (≈ 4)               | 2 (`views` e `viewsDaily`)\* |
| Busca sem resultado (novo termo)     | 0                                  | 1 (`searchMisses`)           |

\* No máximo uma vez por leitor, artigo e dia (deduplicado no navegador).
Admins não contam acessos. As regras de segurança também fazem leituras
internas (`get`/`exists` do perfil e do artigo), que **contam na cota**:
cerca de 1 a 2 a mais por operação.

## Cenário de referência

100 leitores por dia, cada um com 8 artigos abertos, 3 páginas de navegação
(≈ 15 leituras cada) e 1 carga do índice (≈ 5 leituras):

- Leituras: 100 × (8 × 4 + 3 × 15 + 5 + regras ≈ 15) ≈ **9 mil / dia** (18%)
- Gravações: 100 × 8 × 2 = **1,6 mil / dia** (8%)

Folga aproximada: as **leituras** estouram em torno de **500 leitores por dia**
com esse perfil, e as gravações só perto de 1.200.

## Painel de métricas (admin)

Cada carga lê um documento por artigo, um por (artigo × dia com acesso) no
período e até 20 termos buscados. No pior caso, com 300 artigos e período de
30 dias: 300 + 300 × 30 ≈ **9,3 mil leituras por carga**. Por isso o painel
só carrega ao abrir ou ao clicar em "Atualizar", e o período de 90 dias deve
ser usado com parcimônia.

## Fila de revisão (admin)

Cada carga da tela "Revisão" lê um documento por artigo em revisão e todos os
blocos (para mostrar o caminho). Com 60 artigos na fila e 15 blocos, são cerca
de 75 leituras. Aprovar publica o artigo e atualiza o índice de busca do
produto: 1 gravação do artigo, 1 da versão e as do índice (mais as regras de
segurança), por artigo aprovado. Aprovar a fila inteira de uma vez custa
algumas centenas de gravações, bem abaixo do limite diário.

## Onde a cota pode apertar

1. **Painel de métricas com período longo**: o maior consumidor individual.
2. **Índice de busca grande**: cada carga lê o documento (ou as partes) de
   todos os produtos permitidos. O cache persistente do Firestore reduz o
   custo de reabrir a aplicação, mas não o elimina.
3. **Importação da Fase 5**: milhares de gravações. Rodar fora do horário de
   uso e em lotes, para não consumir a cota do dia dos leitores.

Se a cota deixar de bastar, o caminho é migrar para o plano Blaze (pago por
uso) ou agregar `viewsDaily` em documentos mensais.
