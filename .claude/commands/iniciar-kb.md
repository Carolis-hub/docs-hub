---
description: Sobe o docs-hub no localhost (npm run dev) para conferir os artigos importados
argument-hint: '[--assistente]'
---

Suba o sistema na máquina do usuário, em português do Brasil e em linguagem
simples. Argumentos recebidos: `$ARGUMENTS`

1. Em `C:\projetos\docs-hub` (confirme com o usuário se o caminho for outro),
   confira se `node_modules` existe; se não, rode `npm install` e avise que
   pode demorar. Se o `git pull` anterior reclamou do `package-lock.json`, o
   remédio é `git checkout -- package-lock.json`.
2. Rode `npm run dev` **em segundo plano** e confira a saída até aparecer o
   endereço. Informe `http://localhost:5173`. Se a porta estiver em uso, diga
   que o sistema provavelmente já está aberto e use o endereço que o Vite
   mostrar.
3. Diga como conferir os artigos importados: entrar como admin, pesquisar um
   termo (por exemplo "tipo de índice") e abrir o artigo.
4. Só se `$ARGUMENTS` trouxer `--assistente`: avise que o assistente de IA
   gasta com a API (cerca de US$ 0,05 a 0,10 por pergunta) e precisa de
   `ANTHROPIC_API_KEY` já configurada no terminal do usuário. Se ele
   confirmar que a chave está configurada, rode em segundo plano, com
   `GOOGLE_APPLICATION_CREDENTIALS=C:\projetos\service-account-dev.json`:
   `npm run assistente -- --projeto docs-hub-dev-16c1f`.
   **Nunca** peça, mostre ou repita a chave. Sem `--assistente`, não inicie o
   assistente.
5. Lembre que, para parar o sistema, basta fechar o terminal ou pedir para você
   encerrar o processo.

Em sessão na nuvem, o endereço `localhost` não abre no computador do usuário:
diga isso e entregue o comando `npm run dev` para ele rodar localmente.
