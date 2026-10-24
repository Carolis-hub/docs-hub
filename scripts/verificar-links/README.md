# verificar-links

Confere os links e as imagens dos **artigos publicados** (Fase 7 do
[PLAN.md](../../PLAN.md)). Roda toda segunda na Action
[`verificar-links.yml`](../../.github/workflows/verificar-links.yml) e gera
`relatorio-links.md`, que aparece no resumo da execução e fica como artifact. A
execução fica vermelha quando há links quebrados, para a notificação do GitHub
chegar.

## O que é conferido

| Alvo                                          | Resultado                                            |
| --------------------------------------------- | ---------------------------------------------------- |
| Link para outro artigo (`/a/<id>`)            | Quebrado se o artigo não existe ou voltou a rascunho |
| Link para um bloco (`/b/<id>`)                | Quebrado se o bloco não existe                       |
| Link externo e imagem `http(s)`               | HEAD (e GET se o servidor não aceitar HEAD)          |
| `mailto:` e `tel:`                            | Ignorados                                            |
| Âncora (`#x`) e caminho relativo desconhecido | Quebrados (o app não os resolve)                     |

Nos externos, **404, 410 e domínio inexistente** são "quebrados". **401, 403,
429, 5xx e falta de resposta** são "inconclusivos": muitos sites bloqueiam
robôs sem que o link esteja morto, então esses ficam num quadro à parte para
conferir à mão e não derrubam a execução.

## Configuração (repositório do GitHub)

Segredo `FIREBASE_SERVICE_ACCOUNT` e variável `FIREBASE_PROJECT_ID`.

## Uso local

```bash
export GOOGLE_APPLICATION_CREDENTIALS=sa.json
node scripts/verificar-links/index.ts --projeto docs-hub-prod
node scripts/verificar-links/index.ts --projeto docs-hub-prod --sem-externos --estrito
```

Cada execução lê todos os artigos (um documento por artigo). Os links externos
repetidos são conferidos uma vez só.
