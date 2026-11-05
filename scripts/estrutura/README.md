# estrutura — unidades de negócio (BU)

Cria uma unidade de negócio e liga a ela produtos que já existem. A hierarquia
fica **BU → produto → subproduto**; a BU é cadastrada na tela **Unidades**
(admin) e escolhida ao editar cada produto. Este script serve para ligar os
produtos já importados sem passar pela tela, um a um.

```
npm run estrutura -- --projeto docs-hub-dev-16c1f --unidade "Process Solution" --produto "SmartShare 4"
```

Sem `--gravar` é só simulação. Para aplicar, repita o comando com `--gravar`.

| Opção              | Para quê                                                    |
| ------------------ | ----------------------------------------------------------- |
| `--unidade <nome>` | Nome da BU. O id é `u-<nome>`, então rodar de novo é seguro |
| `--produto <ref>`  | Produto a ligar (id, nome ou slug); pode repetir            |
| `--sem-unidade`    | Liga todos os produtos que ainda não têm unidade            |
| `--descricao`      | Descrição da BU (só ao criar)                               |

Um produto que já está em **outra** unidade não é movido (o script avisa); a
troca é feita ao editar o produto na tela.

Credenciais: `GOOGLE_APPLICATION_CREDENTIALS` apontando para a chave de serviço
(ou `FIRESTORE_EMULATOR_HOST` nos testes).
