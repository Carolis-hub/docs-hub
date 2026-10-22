# backup

Exporta o Firestore inteiro (coleções e subcoleções) em JSON, **comprime e
cifra** o arquivo. Roda toda noite na GitHub Action
[`backup.yml`](../../.github/workflows/backup.yml), que guarda o resultado como
artifact por 30 dias (Fase 7 do [PLAN.md](../../PLAN.md)).

## Por que o arquivo é cifrado

O backup tem e-mails dos usuários e todo o conteúdo, inclusive o técnico. Este
repositório é público, e os artifacts de um repositório público podem ser
baixados por qualquer pessoa logada no GitHub. Por isso a cifragem
(AES-256-GCM, chave derivada da senha com scrypt) é obrigatória na Action, e a
senha fica só em `BACKUP_PASSPHRASE`. **Guarde essa senha em outro lugar além do
GitHub: sem ela o backup não abre.** As chaves de IA dos usuários
(`users.*.aiKey`) nunca entram no arquivo.

## Configuração (repositório do GitHub)

| Tipo     | Nome                       | O quê                                                          |
| -------- | -------------------------- | -------------------------------------------------------------- |
| Segredo  | `FIREBASE_SERVICE_ACCOUNT` | JSON da service account (papel `Cloud Datastore Viewer` basta) |
| Segredo  | `BACKUP_PASSPHRASE`        | Senha de cifragem, longa e aleatória                           |
| Variável | `FIREBASE_PROJECT_ID`      | Ex.: `docs-hub-prod`                                           |

O GitHub desativa workflows agendados depois de 60 dias sem atividade no
repositório: confira a aba Actions de vez em quando.

## Uso local

```bash
export BACKUP_PASSPHRASE=…  GOOGLE_APPLICATION_CREDENTIALS=sa.json
node scripts/backup/index.ts --projeto docs-hub-prod --saida backups
# → backups/docs-hub-docs-hub-prod-2026-10-22.json.gz.enc

# Restaurar (simulação por padrão; teste primeiro no dev)
node scripts/backup/restaurar.ts backups/….json.gz.enc --projeto docs-hub-dev
node scripts/backup/restaurar.ts backups/….json.gz.enc --projeto docs-hub-dev --gravar
```

A restauração **não sobrescreve** documentos que já existem, a menos que se use
`--sobrescrever`. Como as chaves de IA ficam fora do backup, cada admin precisa
cadastrar a sua de novo depois de uma restauração completa.

## O que o backup não cobre

- **Imagens:** ficam no Cloudinary e o Firestore guarda só o endereço. Se uma
  imagem for apagada lá, o backup não a traz de volta.
- **Contas do Firebase Auth** (senhas): o backup traz os perfis em `users/`,
  não as contas de login. Se o projeto de Auth for perdido, as contas precisam
  ser recriadas pela tela "Usuários" com os mesmos e-mails.
- O arquivo é montado em memória: serve para o porte do plano Spark; muito
  acima disso, trocar por exportação gerenciada do Firestore.
