# Roadmap

Lista viva do que falta fazer. Quem terminar uma tarefa marca aqui (`[x]`) e
faz commit. Um chat novo do Claude começa lendo este arquivo e o `CLAUDE.md`.

> **Se você já tem um roadmap próprio**, cole-o em "Roadmap do time" abaixo (ou
> peça ao Claude para incorporá-lo). A seção "Pendências conhecidas" foi
> escrita a partir do que ficou aberto no trabalho das fases 0 a 7.

## Roadmap do time

_(cole aqui)_

## Pendências conhecidas

### Conteúdo (SmartShare 4)

- [x] Importar os 57 artigos só com texto no Firebase `dev`
- [ ] Configurar o Cloudinary (conta, preset sem assinatura, pasta fixa)
- [ ] Migrar as 211 imagens: rodar o importador sem `--sem-imagens` e com
      `--sobrescrever` (fazer antes de editar os artigos à mão)
- [ ] Gerar e revisar os textos alternativos (`npm run alt-texto`), com a chave
      da API da Anthropic
- [ ] Decidir quais artigos são "técnicos" (`--tecnico "<regex>"` no adaptador)
- [ ] Decidir sobre o rodapé "Possui alguma dúvida ou sugestão?" (24 artigos)
- [ ] Conferir artigos com tabelas (o editor não tem tabela; viram texto)
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

### Backlog (do `PLAN.md`)

- [ ] Versões por versão do produto
- [ ] Botão "Este artigo foi útil?"
- [ ] Busca semântica
- [ ] Exportação em PDF

## Como atualizar este arquivo

1. Terminou uma tarefa? Troque `[ ]` por `[x]` e, se couber, anote a data.
2. Surgiu algo novo? Acrescente na seção certa.
3. Faça commit (peça ao Claude ou use `git add docs/roadmap.md && git commit`).
