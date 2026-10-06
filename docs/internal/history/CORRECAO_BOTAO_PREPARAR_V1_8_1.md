# v1.8.1 — Correção do botão Preparar documento

## Problema
Em telas com altura menor, as opções do painel lateral ultrapassavam a viewport e o botão `Preparar documento` ficava fora da área visível. Havia também uma regra CSS duplicada que anulava `position: sticky`.

## Correção
- O painel lateral passa a ter rolagem própria no desktop.
- A barra de ação fica sticky na parte inferior do painel.
- Removida a regra que sobrescrevia o comportamento sticky.
- Adicionado texto auxiliar quando ainda não há PDF selecionado.
- Em telas <= 900 px, o painel volta ao fluxo natural da página.
