# assistente — perguntas em linguagem natural sobre a documentação

O assistente responde com base **só nos artigos publicados** a que a pessoa tem
acesso e **sempre cita as fontes**. Se a documentação não traz a resposta, ele
diz isso em vez de inventar.

O navegador não pode guardar a chave da Anthropic. Por isso as perguntas passam
por um **servidor** (este comando), que confere quem está perguntando (login do
Firebase), lê o conteúdo permitido, chama a IA e controla o gasto.

## Como usar (no seu computador)

1. Ponha a chave da Anthropic na sessão do terminal (o `cmd` esquece ao fechar):
   ```
   set ANTHROPIC_API_KEY=sua-chave-aqui
   set GOOGLE_APPLICATION_CREDENTIALS=C:\projetos\service-account-dev.json
   ```
2. Suba o servidor:
   ```
   npm run assistente -- --projeto docs-hub-dev-16c1f
   ```
3. No arquivo `.env.development` do sistema, acrescente (e reinicie o `npm run dev`):
   ```
   VITE_ASSISTENTE_URL=http://localhost:8787
   ```
4. Publique as regras novas do Firestore (coleções do assistente):
   ```
   npx firebase deploy --only firestore:rules --project docs-hub-dev-16c1f
   ```
5. Abra **Assistente** no menu e pergunte.

A tela **Uso da IA** (menu admin) mostra perguntas, gasto estimado, avaliações e
as perguntas que a documentação não respondeu.

## Como a resposta é montada

1. **Perfil e cota:** a conta precisa ter perfil ativo; há um limite de perguntas
   por pessoa por dia e um teto de gasto por dia (veja abaixo).
2. **Escopo:** produtos permitidos à pessoa, reduzidos pelos filtros (unidade,
   produto, subproduto, categoria). Um filtro nunca amplia o acesso.
3. **Busca sem embeddings:** a IA reformula a pergunta em 3 a 5 consultas; o
   motor de busca do sistema (o mesmo da tela de busca) acha candidatos e junta
   os resultados; se houver mais candidatos que o limite, a IA escolhe os
   melhores. A Anthropic não oferece API de embeddings, e o objetivo era manter
   o Firebase sem um banco vetorial novo. A troca por embeddings fica possível
   depois (só muda `recuperar.ts`).
4. **Acesso conferido de novo:** o servidor usa o Admin SDK, que ignora as regras
   do Firestore, então `carregarFontes` repete a regra: só artigo **publicado**,
   de produto permitido e, se técnico, para quem pode ver técnico.
5. **Resposta:** a IA recebe os artigos como documentos numerados e responde em
   Markdown simples, com citações `[1]`, `[2]`. As citações são conferidas: só
   valem números de documentos que ela realmente recebeu. O texto é desenhado
   sem `innerHTML`, então HTML na resposta aparece como texto.
6. Sem artigo relevante, a IA de resposta nem é chamada (economiza e evita
   invenção).

## Limites e modelos

Tudo por variável de ambiente (valores padrão entre parênteses):

| Variável                          | O que controla                                          |
| --------------------------------- | ------------------------------------------------------- |
| `ASSISTENTE_MODELO`               | Modelo que escreve a resposta (`claude-opus-5-5`)       |
| `ASSISTENTE_MODELO_BUSCA`         | Modelo que reformula e escolhe artigos (igual ao acima) |
| `ASSISTENTE_PERGUNTAS_POR_DIA`    | Perguntas por pessoa por dia (30)                       |
| `ASSISTENTE_ORCAMENTO_DIARIO_USD` | Teto de gasto estimado por dia, de todos juntos (10)    |
| `ASSISTENTE_MAX_FONTES`           | Artigos lidos pela IA em cada resposta (5)              |
| `ASSISTENTE_MAX_CANDIDATOS`       | Candidatos levados à escolha (12)                       |
| `ASSISTENTE_MAX_CARACTERES_FONTE` | Tamanho máximo lido de cada artigo (6000)               |

**Custo:** cada pergunta faz até 3 chamadas à IA. Pela conta do tamanho dos
textos, cerca de 10 mil tokens de entrada na resposta; no Opus 5.5 isso dá da
ordem de **US$ 0,05 a 0,10 por pergunta** (estimativa, a medir). Se o custo
pesar, a troca mais simples é usar um modelo menor só na etapa de busca
(`ASSISTENTE_MODELO_BUSCA=claude-haiku-5-5`). O gasto é estimado pelos tokens
que a API informa; confira a fatura real no painel da Anthropic.

A cota zera à meia-noite de Brasília. Quando a IA falha, a pergunta volta para a
cota. Ao bater o teto do dia, o assistente avisa e para até o dia seguinte.

## O que é gravado

- `assistenteUso/{id}`: contadores por dia (um global, um por pessoa).
- `assistenteLog/{id}`: cada pergunta (até 500 caracteres), se achou resposta,
  quais artigos citou, tokens, custo estimado e a avaliação da pessoa. **Guarda o
  texto das perguntas**: só admins leem.
- Nada é escrito nos artigos. O assistente não publica nem edita nada.

## Medir a qualidade das respostas

Para saber se o assistente está respondendo bem (e se uma mudança de modelo,
de prompt ou de limite ajudou ou piorou), monte um conjunto de perguntas e rode:

```
npm run assistente-avaliar -- --casos C:\projetos\avaliacao.json --projeto docs-hub-dev-16c1f --como <uid-de-um-usuario> --executar
```

Sem `--executar` ele só confere o arquivo e diz quantas chamadas faria (a
avaliação **gasta com a IA**: até 3 chamadas por pergunta). O exemplo do arquivo
está em `docs/avaliacao-assistente.exemplo.json`. Cada caso diz:

| Campo             | O que confere                                                                    |
| ----------------- | -------------------------------------------------------------------------------- |
| `pergunta`        | O que perguntar                                                                  |
| `filtros`         | Os mesmos filtros da tela (unidade, produto, subproduto, categoria)              |
| `fontesEsperadas` | Artigos que precisam ser citados: o id ou um pedaço do título                    |
| `termos`          | Palavras que a resposta precisa trazer (sem diferenciar maiúscula nem acento)    |
| `termosProibidos` | Palavras que não podem aparecer (um valor inventado, por exemplo)                |
| `deveEncontrar`   | `false` para perguntas que a documentação **não** responde: a IA precisa recusar |

Além disso, todo caso confere que as citações `[n]` apontam para fontes reais e
que uma resposta "encontrada" traz fonte. O relatório (`.avaliacao/avaliacao.md`)
mostra a taxa de casos aprovados, quantas fontes esperadas foram citadas, quantas
perguntas sem resposta foram recusadas, o gasto estimado e, por caso reprovado, o
motivo e a resposta dada. Com `--minimo 0.8` (padrão) o comando sai com erro se a
taxa ficar abaixo. As perguntas rodam **em nome do usuário** de `--como`, então
valem o produto permitido e o acesso técnico dele, e **não entram** na cota nem
em "Uso da IA".

Dicas: comece com 15 a 30 perguntas reais que o suporte recebe; inclua umas 20%
de perguntas sem resposta; rode antes e depois de cada mudança.

## Em produção

Este servidor precisa ficar no ar num lugar com Node 22.18 ou mais novo e a
chave da Anthropic guardada como segredo. O plano gratuito do Firebase (Spark)
**não** hospeda servidor nem Cloud Functions; as opções são o plano Blaze
(Functions ou Cloud Run, pago por uso) ou outro serviço de hospedagem de Node.
Ainda não foi escolhido; veja `docs/roadmap.md`. Em qualquer opção, o sistema só
precisa de `VITE_ASSISTENTE_URL` apontando para o endereço público e de
`--origem` com o endereço do sistema.

## Limites conhecidos

- A chamada real à API da Anthropic não foi exercitada (depende de chave): o
  restante (login, escopo, busca, cota, registro, tela) é testado com uma IA
  falsa contra o Emulator do Firestore.
- Busca por reformulação cabe em dezenas ou poucas centenas de artigos por
  produto; para milhares, vale trocar por embeddings.
- A conversa fica só na tela (não é guardada); as últimas 6 mensagens vão junto
  de cada pergunta.

## Chave de IA por usuário

Cada usuário pode guardar a própria chave em **Minhas preferências** (ícone do
perfil, no topo). Ela fica só no navegador (localStorage) e vai ao servidor no
cabeçalho `X-Chave-IA` a cada pergunta; o servidor a usa só naquela chamada e
não a grava nem a registra. Sem `ANTHROPIC_API_KEY` no servidor, quem não tiver
chave própria recebe um aviso para informar a sua. A cota por usuário e o teto
diário continuam valendo. Hoje só há adaptador para a Anthropic.
