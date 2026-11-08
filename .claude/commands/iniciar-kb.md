---
description: Extrai artigos da base do SmartShare e importa para o docs-hub (simula, mostra o relatório e só grava com a sua confirmação)
argument-hint: '[ids dos artigos separados por vírgula | --tudo] [--produto smartshare|smartshare-4]'
---

Você vai levar artigos da base `docs.selbetti.com.br` para o docs-hub, em etapas,
conferindo cada uma antes da seguinte. Fale em português do Brasil, em linguagem
simples, e use comandos copiáveis para o PowerShell quando precisar da ajuda do
usuário. Argumentos recebidos: `$ARGUMENTS`

## Antes de começar

1. Se esta sessão for na nuvem, ela **não alcança `docs.selbetti.com.br`**: a
   extração e o download de imagens não funcionam aqui. Diga isso e entregue
   os comandos para o usuário rodar na máquina dele (o passo a passo está em
   `scripts/migrate/README.md`). Só continue sozinho se estiver numa máquina
   com acesso ao site.
2. Nunca peça nem mostre senhas ou chaves. A chave do Firebase fica fora do
   repositório (`C:\projetos\service-account-dev.json`).
3. **Nunca use `--gravar` sem o usuário confirmar**, depois de ver o relatório
   da simulação. Sem `--publicar`, os artigos entram na fila de Revisão.

## Caminhos padrão (confirme com o usuário se algum não existir)

- Extrator: `C:\Qualidade\smartshare-kb\smartshare-kb` (tem `scripts\extrair_kb.py` e `kb\`)
- Saída da conversão: `C:\projetos\dados\export-conceitos`
- Projeto: `C:\projetos\docs-hub`
- Firebase de teste: `docs-hub-dev-16c1f`

## Etapas

1. **Extrair** (só se a pasta `kb\<produto>` não existir ou o usuário pedir
   atualização): na pasta do extrator, `python scripts\extrair_kb.py --raiz smartshare`
   (ou `--raiz smartshare-4`); com `--incremental` quando a pasta já existe.
   Confira com `dir kb`.
2. **Escolher os artigos**: se `$ARGUMENTS` trouxe ids, use-os. Se trouxe
   `--tudo`, converta sem `--apenas`. Se não trouxe nada, procure em `kb\` os
   artigos de conceito (por exemplo `Get-ChildItem kb -Recurse -Filter *tipo-de-indice*`),
   liste título e `id:` do front matter e **pergunte** quais importar.
3. **Converter**, a partir de `C:\projetos\docs-hub`:
   `node scripts\migrate\adaptadores\smartshare-kb.ts <pasta do extrator> C:\projetos\dados\export-conceitos --apenas <ids>`
   Confira a mensagem "Exportação neutra: N blocos, M artigos".
4. **Simular** (não grava nada):
   `npm run migrate -- C:\projetos\dados\export-conceitos --sem-imagens`
   Resuma o relatório: blocos, artigos, imagens puladas, links quebrados,
   erros. Se houver erro, explique a causa em linguagem simples e pare.
5. **Gravar, só com confirmação explícita**:
   `$env:GOOGLE_APPLICATION_CREDENTIALS="C:\projetos\service-account-dev.json"`
   `npm run migrate -- C:\projetos\dados\export-conceitos --sem-imagens --gravar --projeto docs-hub-dev-16c1f`
   Se der `DEADLINE_EXCEEDED`, rodar de novo é seguro; acrescente `--rest` se persistir.
6. **Depois**: lembre o usuário de abrir **Revisão** como admin, ler e aprovar
   os artigos, e de que `--sobrescrever` refaz o conteúdo de artigos já
   importados (não use sem avisar). Para que a busca com IA use o texto maior,
   os artigos antigos precisam ser reimportados com `--sobrescrever`.

7. **Abrir o sistema** (a menos que `$ARGUMENTS` traga `--sem-app`): em
   `C:\projetos\docs-hub`, rode `npm run dev` em segundo plano e avise que o
   sistema está em `http://localhost:5173`. Se a porta já estiver em uso, diga
   que o sistema provavelmente já está aberto. Sugira pesquisar um termo dos
   artigos importados (por exemplo "tipo de índice") para conferir a busca.
   **Não** inicie o assistente de IA (`npm run assistente`) por conta própria:
   ele gasta com a API e precisa de `ANTHROPIC_API_KEY`. Só ofereça, e só se
   o usuário disser que a chave já está configurada no terminal dele. Nunca
   peça nem repita a chave.

Ao terminar, diga o que foi feito, o que **não** foi exercitado (por exemplo,
imagens e respostas reais da IA) e o próximo passo.
