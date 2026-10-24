# cloudinary-limpeza

Acha (e opcionalmente apaga) imagens do Cloudinary que nenhum artigo usa mais.
Excluir imagens exige a **API secret**, que não pode ir para o navegador; por
isso a limpeza roda na Action
[`limpeza-cloudinary.yml`](../../.github/workflows/limpeza-cloudinary.yml), aos
domingos (Fase 7 do [PLAN.md](../../PLAN.md)).

## O que conta como "em uso"

Uma imagem é considerada em uso se aparece no **artigo atual**, em **qualquer
versão do histórico** (para que "restaurar versão" continue funcionando) ou em
uma **sugestão pendente da IA**. O `public_id` é extraído da URL de entrega,
ignorando versão (`v123/`), transformações e extensão.

## Travas de segurança

- **Carência de 7 dias** (`--carencia`): imagens novas não são apagadas, porque
  podem ser de um artigo que ainda não foi salvo.
- **Não apaga** se nenhum artigo foi lido do Firestore, se nenhuma imagem está
  referenciada (nome da conta ou pasta errados) ou se apagaria **mais da
  metade** das imagens. `--forcar` ignora as travas.
- Sem `--apagar` é só relatório.

## Implantação gradual

A execução agendada **só gera o relatório** (no resumo da execução) até você
criar a variável `CLOUDINARY_LIMPEZA_APAGAR=true`. Confira o relatório por
algumas semanas antes de habilitar. Pelo "Run workflow", a opção `apagar`
decide caso a caso.

## Configuração (repositório do GitHub)

| Tipo     | Nome                        | O quê                                      |
| -------- | --------------------------- | ------------------------------------------ |
| Segredo  | `FIREBASE_SERVICE_ACCOUNT`  | JSON da service account                    |
| Segredo  | `CLOUDINARY_API_KEY`        | Chave da API do Cloudinary                 |
| Segredo  | `CLOUDINARY_API_SECRET`     | Secret da API do Cloudinary                |
| Variável | `FIREBASE_PROJECT_ID`       | Ex.: `docs-hub-prod`                       |
| Variável | `CLOUDINARY_CLOUD_NAME`     | Nome da conta                              |
| Variável | `CLOUDINARY_FOLDER`         | Opcional: só esta pasta                    |
| Variável | `CLOUDINARY_LIMPEZA_APAGAR` | `true` para apagar nas execuções agendadas |

Cada execução lê todos os artigos e versões (custo em leituras do Firestore
proporcional ao histórico), então é semanal.

## Uso local

```bash
export CLOUDINARY_CLOUD_NAME=… CLOUDINARY_API_KEY=… CLOUDINARY_API_SECRET=…
export GOOGLE_APPLICATION_CREDENTIALS=sa.json
node scripts/cloudinary-limpeza/index.ts --projeto docs-hub-prod            # relatório
node scripts/cloudinary-limpeza/index.ts --projeto docs-hub-prod --apagar   # apaga
```
