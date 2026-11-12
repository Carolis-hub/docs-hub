# Padrão de manual de usuário

Como os artigos do docs-hub devem ser escritos. O script `npm run padronizar`
lê **este arquivo** e usa as regras abaixo para conferir os artigos e propor a
reescrita. Mudou o padrão aqui, mudou para o script: não há outra cópia.

> O público é o **usuário final do produto**, não quem programa ou implanta.
> Conteúdo técnico entra como artigo de público "Técnico", com o mesmo padrão
> de clareza.

## Princípios

1. **Orientado à tarefa.** O leitor chega com um objetivo ("quero acompanhar
   minhas atividades"). O artigo responde a isso, não descreve o sistema.
2. **Escaneável.** Títulos de seção, listas, tabelas e passos numerados. Quase
   ninguém lê parágrafos longos.
3. **Fiel ao produto.** Nomes de menus, botões e campos exatamente como
   aparecem na tela. Nada de comportamento que o texto original não diga.
4. **Uma coisa, um nome.** Se a tela diz "Minhas Atividades", é sempre assim,
   nunca "Atividades do usuário" numa frase e "painel de tarefas" na outra.

## Estrutura por tipo de artigo

### Procedimento ("Como …")

1. **Título:** "Como" + verbo no infinitivo + o que se faz. Ex.: _Como
   acompanhar suas atividades_.
2. **Abertura:** uma ou duas frases dizendo o que o procedimento permite e
   quando usá-lo.
3. **Antes de começar:** o que é preciso ter (permissão, módulo ou licença,
   dados). Fica **no início**, nunca só no fim.
4. **Passo a passo:** lista numerada, **uma ação por passo**, começando com
   verbo (Clique, Selecione, Informe). Menus, botões e campos em **negrito**.
5. **Resultado:** o que o usuário vê ao terminar.
6. **Observações / Veja também:** exceções, avisos e links, em poucos itens.

### Funcionalidade (visão geral de uma tela ou recurso)

1. **Título:** o nome da funcionalidade como aparece no produto.
2. **Para que serve:** uma ou duas frases.
3. **Antes de começar:** pré-requisitos (módulo, licença, perfil).
4. **Onde encontrar:** caminho de menu ("Portal › Minhas Atividades").
5. **Seções por elemento:** cada painel, botão ou opção como item de lista ou
   linha de tabela: **nome em negrito** + descrição curta (uma frase).
6. **Veja também.**

### Configuração (campos e parâmetros)

Abertura curta, **Antes de começar**, e uma tabela **Campo | O que faz |
Valores ou observações**. Os campos ficam na ordem da tela.

## Regras de escrita

- **Parágrafos curtos:** até 3 ou 4 linhas. Quebrou a ideia, quebre o
  parágrafo.
- **Frases curtas**, na voz ativa, falando com o leitor ("você").
- **Definições em lista ou tabela**, não em parágrafos soltos com um termo em
  negrito no começo de cada um.
- **Estados e opções:** nada de CAIXA ALTA. Use negrito ou uma tabela
  (_No prazo_, _Em risco_, _Atrasadas_).
- **Figuras:** não dependa de posição ("na figura abaixo"). Escreva "Veja a
  tela **Minhas Atividades**" e deixe a imagem logo depois do parágrafo que a
  explica.
- **Avisos:** uma linha, começando com **Atenção:** ou **Dica:**.
- **Siglas** explicadas na primeira vez (BPM, ECM…), se o leitor comum não as
  conhece.
- **Sem repetir o título** no corpo e sem "Introdução" vazia.

## Imagens

- Texto alternativo que descreve **o que a imagem mostra e por que importa**.
  Nunca vazio, nunca "IMG", "imagem" ou "print".
- A reescrita **não mexe** nas imagens (endereço e texto alternativo). Os
  textos alternativos fracos são tratados por `npm run alt-texto`.

## O que a padronização nunca faz

- Não muda o comportamento descrito, nem os números, prazos, nomes e regras.
- Não inventa telas, campos ou passos. Quando faltar informação para cumprir o
  padrão (por exemplo, os passos de um procedimento), marca no texto
  `[Confirmar: …]` e lista a dúvida para o revisor.
- Não apaga conteúdo: tudo que o original diz continua dito, só reorganizado.
- Não publica. O resultado é uma **sugestão** que uma pessoa aprova.

## Exemplo (antes e depois)

Antes: um parágrafo único explica a tela, define cada painel em parágrafos com
termo em negrito, escreve os estados em caixa alta e deixa o pré-requisito para
a última linha.

Depois:

```markdown
## Para que serve

Acompanhe o andamento das suas tarefas e veja o que está no prazo, em risco
ou atrasado.

## Antes de começar

O módulo **Tarefas** precisa estar ativo na licença. Se não estiver, fale com
o seu fornecedor.

## Onde encontrar

No lado direito do portal, no menu rápido **Minhas Tarefas**.

## Situação das tarefas

| Situação | Significa                                 |
| -------- | ----------------------------------------- |
| No prazo | Dentro do prazo previsto para a conclusão |
| Em risco | Pode ultrapassar o prazo                  |
| Atrasada | O prazo já venceu                         |

## Painéis

- **Minhas Tarefas:** todas as tarefas do seu perfil.
- **Minhas Solicitações:** o que você pediu.
- **Tarefas da Equipe:** tarefas de quem está abaixo de você na hierarquia.
```
