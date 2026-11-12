# busca — medir a taxa de acerto da busca

Responde, com números, à pergunta "a busca acha o artigo certo?". Você escreve
as consultas que as pessoas realmente fazem e diz qual artigo deveria aparecer;
o comando roda cada uma no **mesmo motor da tela de busca** (com os sinônimos
do produto) e mostra onde o artigo ficou.

**Não usa IA e não custa nada**: só lê o índice de busca dos produtos citados
(poucas leituras no Firestore) e não grava nada no sistema.

## Como usar (no seu computador)

1. Copie `docs/avaliacao-busca.exemplo.json` para fora do repositório (as
   consultas reais podem citar assuntos internos), por exemplo
   `C:\projetos\consultas-busca.json`, e troque os casos pelos seus.
2. Aponte para a chave do Firebase (o `cmd` esquece ao fechar):
   ```
   set GOOGLE_APPLICATION_CREDENTIALS=C:\projetos\service-account-dev.json
   ```
3. Rode:
   ```
   npm run busca-avaliar -- --casos C:\projetos\consultas-busca.json --projeto docs-hub-dev-16c1f
   ```
4. Abra o relatório `.avaliacao\avaliacao-busca.md`.

## O arquivo de casos

| Campo       | O que é                                                                         |
| ----------- | ------------------------------------------------------------------------------- |
| `id`        | Um nome curto para o caso (sem repetir)                                         |
| `consulta`  | O que a pessoa digitaria na busca, **com as palavras dela**                     |
| `produto`   | Produto em que buscar: o id ou o nome (ou parte do nome, se não for ambíguo)    |
| `esperados` | Artigos que respondem: o id ou um pedaço do título. Basta **um** deles aparecer |

## O que o relatório traz

- Quantos casos tiveram o artigo certo **entre os 5 primeiros** (a taxa que o
  comando compara com `--minimo`, 85% por padrão) e quantos **em primeiro lugar**.
- Quantas buscas não trouxeram nada.
- Quantos casos só foram achados **por aproximação**: nenhum artigo tinha
  todas as palavras e a busca mostrou os que tinham a maior parte. Muitos
  casos assim indicam palavras que valem um sinônimo.
- Para cada caso que falhou: o que veio no lugar, com a seção que a busca
  escolheu.

## Como ler uma falha

| O que aconteceu                                    | O que fazer                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| A busca não trouxe nada, mas o artigo existe       | Falta a palavra no artigo ou um grupo em **Sinônimos da busca** (na tela do produto) |
| A busca não trouxe nada e não há artigo            | Falta escrever o artigo: é lacuna de documentação                                    |
| O artigo veio, mas depois da 5ª posição            | O título ou o resumo do artigo não falam do assunto; ajuste-os                       |
| Muitas falhas por vocabulário, mesmo com sinônimos | É o sinal para avaliar a busca semântica (Etapa B do estudo)                         |

## Dicas

- Comece com 30 a 50 consultas reais do suporte. Não invente consultas olhando
  o título do artigo: use as palavras de quem perguntou.
- Rode antes e depois de mexer nos sinônimos ou nos artigos, para ver se
  melhorou.
- `--sem-tecnico` roda como um leitor que não vê artigos técnicos.
- Os artigos publicados antes das seções só as ganham ao serem publicados de
  novo ou reimportados; sem elas a busca funciona, só não aponta a seção.

## Limites conhecidos

- Mede só se o artigo certo aparece, não se o trecho mostrado responde.
- O resultado é tão bom quanto o conjunto de consultas.
- Testado contra o Emulator do Firestore; ainda não foi rodado com a base real.
