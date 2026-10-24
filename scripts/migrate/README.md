# migrate

Importa blocos, artigos e imagens de uma exportação da ferramenta de
documentação atual para o Cloudinary e o Firestore (Fase 5 do
[PLAN.md](../../PLAN.md)).

O importador lê um **formato neutro** (abaixo), independente da ferramenta de
origem. A ferramenta atual é o site WordPress `docs.selbetti.com.br`; o
adaptador [`adaptadores/smartshare-kb.ts`](./adaptadores/smartshare-kb.ts)
converte a base extraída por `smartshare-kb/scripts/extrair_kb.py` para esse
formato (ver "Migrar a base do SmartShare").

Requer **Node 22.18 ou mais novo** (executa TypeScript direto, sem build).

## Formato da exportação

Uma pasta com um `manifesto.json` e os arquivos que ele referencia. Há um
exemplo completo em [`exemplo/`](./exemplo).

```json
{
  "blocos": [
    {
      "id": "smartshare",
      "nome": "Smartshare",
      "descricao": "…",
      "icone": "📦"
    },
    { "id": "bpm", "nome": "BPM", "pai": "smartshare", "ordem": 0 }
  ],
  "artigos": [
    {
      "id": "login",
      "bloco": "bpm",
      "titulo": "Como acessar o BPM",
      "arquivo": "artigos/login.html",
      "publico": "usuario",
      "versaoProduto": "4.2",
      "publicado": true,
      "atualizadoEm": "2025-03-10"
    }
  ]
}
```

- **Blocos**: lista plana. Sem `pai` é um produto. `ordem` é opcional (padrão:
  ordem da lista entre irmãos).
- **Artigos**: `arquivo` (relativo ao manifesto) **ou** `conteudo` (inline).
  `formato` é `html` ou `markdown` (padrão: pela extensão; `.md` é Markdown).
  `publico` padrão `usuario`; `publicado` padrão `true`; `atualizadoEm` vira a
  data de revisão (padrão: a data da importação).
- **Imagens**: `src` relativo ao arquivo do artigo (ou à raiz do export), URL
  `http(s)` ou `data:` base64. Só PNG, JPG e GIF até 5 MB, conferidos pelos
  bytes e não pela extensão.
- **Links entre artigos**: caminho relativo para o arquivo de outro artigo, ou
  `artigo:<id>`. Viram `/a/<id novo>`.

## Migrar a base do SmartShare

```bash
# 1. Extrair a base (precisa de acesso a docs.selbetti.com.br; Python 3.9+)
cd smartshare-kb && python scripts/extrair_kb.py && cd ..

# 2. Converter a pasta kb/ para o formato neutro
node scripts/migrate/adaptadores/smartshare-kb.ts smartshare-kb export-neutro \
  --tecnico "Desenvolvedor|API"          # opcional, ver abaixo

# 3. Simular, revisar o relatório e só então gravar (seção "Uso")
npm run migrate -- export-neutro
```

Regras do adaptador:

- Cada pasta de `kb/` vira um bloco (nome em `categoria` do `_index.md`); as
  pastas de primeiro nível (`smartshare`, `smartshare-4`) são os produtos. A
  hierarquia do site é mantida em qualquer profundidade.
- O id do artigo é o id do WordPress, estável entre extrações.
- `atualizado_em` do site vira a data de revisão, então o painel "sem revisão"
  já nasce correto.
- Artigos `status: descontinuado` entram como **rascunho**; use
  `--publicar-descontinuados` para publicá-los.
- `--tecnico <regex>` marca como "técnico" os artigos cuja `categoria_caminho`
  casar com a expressão. Sem ela, tudo entra como "usuário": a base não diz
  qual público é qual, então vale definir essa regra com o time.
- O H1 repetido do título é removido, títulos H4 a H6 viram H3 (o editor só
  tem H1 a H3) e o prefixo `IMG:` do texto alternativo é tirado.
- Links para outros artigos do site (pela URL) viram links internos do
  docs-hub. Links para categorias ou páginas fora da base seguem como externos.
- As imagens são baixadas da URL original no momento do `--gravar`/da
  simulação, então essa etapa também precisa de acesso ao site. Imagens
  embutidas no HTML do site (`imagem-embutida-no-site`) não são recuperáveis e
  aparecem no relatório como falha.

```bash
# 1. Simulação (padrão): valida tudo e gera o relatório, sem gravar nem enviar
npm run migrate -- caminho/do/export

# 2. Gravar no dev (Cloudinary + Firestore)
export CLOUDINARY_CLOUD_NAME=… CLOUDINARY_UPLOAD_PRESET=…
export GOOGLE_APPLICATION_CREDENTIALS=service-account-dev.json
npm run migrate -- caminho/do/export --gravar --projeto docs-hub-dev

# 3. Só depois de revisar o relatório, repetir no prod
```

Opções: `--sobrescrever` (substitui o que já existe, mantém `views`),
`--verificar-links` (confere links externos por HTTP), `--autor <uid>`,
`--saida <pasta>` (padrão `<export>/.migracao`), `--estrito` (código de saída 1
se houver pendências) e `--ajuda`. Para testar contra o Emulator, defina
`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`.

## O que o importador faz

- Cria os ids de destino a partir dos ids do export (`m-<slug>`), então
  **rodar de novo não duplica**: o que já existe é pulado (ou substituído, com
  `--sobrescrever`).
- Converte HTML ou Markdown no JSON do editor (mesmas extensões do app). Remove
  `<script>` e `<style>`; tabelas, iframes e vídeos viram texto e entram nos
  avisos.
- Envia cada imagem ao Cloudinary uma única vez (dedupe por conteúdo, cache em
  `cache-imagens.json`). Imagem sem texto alternativo recebe um gerado e entra
  na lista para revisão, porque o app exige alt.
- Publicados ganham versão 1, snapshot em `versions` e entrada no
  `searchIndex` (com divisão por subproduto, se necessário). Registra uma
  entrada no `auditLog`.
- Escreve com o Admin SDK, que ignora as regras de segurança: use credenciais
  do projeto certo.

## Relatório de validação

`relatorio.md` e `relatorio.json`, na pasta de saída: imagens com falha, links
quebrados, artigos sem bloco (não importados), artigos com erro, textos
alternativos gerados e avisos. Uma imagem que falha vira o texto
`[Imagem não migrada: …]` no artigo, para nada sumir em silêncio; um link
quebrado perde o link e mantém o texto.

## Convivência e desligamento da ferramenta antiga

1. Importar no `dev`, revisar o relatório e abrir uma amostra dos artigos.
2. Corrigir a origem (ou editar no docs-hub) e repetir até o relatório ficar
   sem pendências.
3. Importar no `prod` e colocar a ferramenta antiga em **somente leitura**.
4. Durante o período de convivência, novas edições são feitas só no docs-hub.
   Reimportar não é seguro depois disso: use `--sobrescrever` com cuidado.
5. Desligar a ferramenta antiga quando o relatório estiver limpo e o tempo de
   convivência combinado tiver passado.
