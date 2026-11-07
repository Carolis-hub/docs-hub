# Desempenho

Medições feitas na Fase 6, com o que foi feito e o que fica como recomendação.
Os números de tamanho vêm do `npm run build`; os de busca, de um teste com artigos
sintéticos longos (`src/utils/desempenho.test.ts`). São medidas de um computador
comum, não de uma máquina de usuário nem da rede da empresa.

## Carga inicial do sistema

| Medida                               | Antes                        | Depois                                                   |
| ------------------------------------ | ---------------------------- | -------------------------------------------------------- |
| JavaScript baixado para abrir a Home | 1.525 kB (468 kB comprimido) | ~935 kB (~286 kB comprimido)                             |
| Arquivos de JavaScript na carga      | 1                            | 3 principais (app 117 kB, React 180 kB, Firebase 629 kB) |

O que mudou:

- As telas **menos usadas** carregam só quando abertas (carga sob demanda):
  artigo, busca, categorias, assistente e todas as de admin. Quem entra na Home
  não baixa o editor nem as telas de admin.
- O **editor de texto (TipTap, ~456 kB)** só vem quando se abre o primeiro
  artigo ou o editor.
- **Firebase e React** ficam em arquivos próprios, com nome estável: numa nova
  versão do sistema o navegador reaproveita o que não mudou.

O Firebase (629 kB) é o maior bloco e é necessário na Home. Reduzi-lo exigiria
trocar de biblioteca (a versão "lite" não tem o cache offline).

## Busca no navegador

Artigos sintéticos de ~4.000 caracteres (o limite que o índice guarda por artigo):

| Artigos | Índice (a baixar) | Montar o motor | Cada busca |
| ------- | ----------------- | -------------- | ---------- |
| 300     | 1,3 MB            | ~75 ms         | < 1 ms     |
| 1.000   | 4,2 MB            | ~320 ms        | ~2 ms      |
| 3.000   | 12,7 MB           | ~870 ms        | ~7 ms      |

Conclusão: o **processamento não é o gargalo**; o que pesa é **baixar o índice**
(~4 KB por artigo longo), uma vez por sessão (o cache do Firebase reaproveita
nas seguintes). Artigos reais costumam ser mais curtos que o limite.

## Problema achado e corrigido: índice grande demais

Um subproduto com muitos artigos longos (a partir de ~200) passava de 1 MiB, o
limite de um documento do Firestore, e **publicar o artigo seguinte falharia**.
Agora, quando uma parte do índice passa de 800 KB, o texto de todos os itens é
encurtado (pela metade, até 200 caracteres; depois removido): título e resumo
ficam, e a busca só perde o fim dos artigos mais longos (`caberNoLimite`, com
testes). Para milhares de artigos num só subproduto, dividir mais fino é o
caminho.

## O que ainda vale fazer (não feito)

- Se o índice ficar pesado para quem tem rede lenta: guardar menos texto por
  artigo (hoje 4.000 caracteres; 2.000 já corta o índice pela metade, com pouca
  perda de busca por título e começo do texto).
- Medir no Firebase real e no navegador do usuário (tempo até a Home aparecer,
  leituras por sessão no painel de uso do Firebase).
- Recarregar o índice só dos produtos que a pessoa abre, em vez de todos de uma vez.
