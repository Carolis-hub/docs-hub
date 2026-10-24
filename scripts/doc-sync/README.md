# doc-sync

Gera **sugestões** de atualização dos artigos do docs-hub a partir de arquivos
`.md` com as regras de um produto ou funcionalidade (Fase 6 do
[PLAN.md](../../PLAN.md)). Nada é publicado: as sugestões ficam em
`articles/{id}/suggestions` até um admin aprovar na tela **Sugestões**.

```
regras .md ──► artigo(s) alvo ──► IA compara e propõe ──► suggestions (pendente)
                                                              │
                                              admin: aprovar / editar / descartar
```

## O arquivo de regras

Markdown livre, com front matter opcional que diz **quais artigos** atualizar:

```markdown
---
titulo: Anexos em atividades # opcional (padrão: o primeiro # do texto)
produto: m-smartshare # opcional: onde buscar artigos, se `artigos` faltar
artigos: 101, 102 # opcional: ids dos artigos no docs-hub
---

# Anexos em atividades

- O tamanho máximo de cada anexo é de 10 MB.
```

Exemplo em [`exemplo/regras-anexos.md`](./exemplo/regras-anexos.md). As regras são
a fonte da verdade: se o artigo as contradiz, a IA propõe corrigi-lo.

**Como o artigo é escolhido**

1. Os ids em `artigos:` (e os passados com `--artigo`), se houver.
2. Sem ids, uma busca (o mesmo MiniSearch do app) pelo título e pelos títulos de
   seção do arquivo, em `produto:`/`--produto` ou em todos os produtos. Os
   melhores resultados (padrão 3) viram sugestões marcadas como "sugerido pela
   busca", para o revisor descartar se não for o artigo certo.
3. Se nada for achado, o script avisa que o artigo precisa ser criado antes.
   Ele **não cria artigos**.

## Uso

```bash
export ANTHROPIC_API_KEY=…
export GOOGLE_APPLICATION_CREDENTIALS=service-account-dev.json

# Simulação: roda a IA e mostra o que mudaria, sem gravar
npm run doc-sync -- regras/anexos.md --projeto docs-hub-dev

# Grava as sugestões
npm run doc-sync -- regras/anexos.md --projeto docs-hub-dev --gravar
```

Requer Node 22.18 ou mais novo. Opções: `--artigo <id>` (repetível), `--produto
<id>`, `--max <n>`, `--modelo <id>` (padrão `claude-opus-5-5`, ou `DOC_SYNC_MODEL`),
`--repo` e `--commit` (só para rastrear a origem). Para testar contra o Emulator,
defina `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`.

## O que acontece com cada artigo

- O JSON do editor vira Markdown; a IA devolve o artigo inteiro em Markdown e o
  resultado volta para o formato do editor. Imagens e links existentes são
  preservados, e a IA recebe a ordem de não inventar telas, campos ou valores.
- A IA pode concluir que o artigo **já está certo**: nesse caso nada é gravado.
- Se a IA indica que as regras mudam telas ou campos, o artigo ganha o alerta
  `prints_desatualizados` (visível no editor, até alguém clicar em "Prints
  atualizados").
- Cada sugestão traz o resumo das mudanças, o motivo e **avisos para o revisor**
  (imagem removida ou nova, texto alternativo genérico).
- O `id` da sugestão vem do arquivo e do hash do conteúdo: rodar de novo com as
  mesmas regras não duplica nem chama a IA. Mudou o arquivo, gera outra.
- Se o artigo for editado depois que a IA o leu, a tela de revisão avisa.

## GitHub Action

[`.github/workflows/doc-sync.yml`](../../.github/workflows/doc-sync.yml) é um
workflow reutilizável (`workflow_call`) para o repositório que guarda os
arquivos de regras. A cada push que altere `regras/**.md`, ele roda o script
só nos arquivos alterados. O comentário no topo do arquivo traz o exemplo de
chamada. Segredos necessários, em **GitHub Secrets** do repositório que chama:

| Segredo                    | O quê                                              |
| -------------------------- | -------------------------------------------------- |
| `FIREBASE_SERVICE_ACCOUNT` | JSON da service account do projeto `dev` ou `prod` |
| `ANTHROPIC_API_KEY`        | Chave da API da Anthropic                          |

A service account usa o Admin SDK, que ignora as regras de segurança: dê a ela
só o papel mínimo (`Cloud Datastore User`) e use uma conta por ambiente.
