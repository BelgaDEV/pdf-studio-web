# v1.7.4 — Comparar PDFs

Nova ferramenta Legal / Business para comparar duas versões de um PDF sem enviar os documentos para servidor.

## O que faz

- carrega um **PDF original** e um **PDF revisado**;
- extrai e compara a camada de texto página a página;
- usa páginas idênticas como âncoras para reduzir falsos positivos quando páginas são inseridas ou removidas;
- classifica páginas como **Sem alteração**, **Modificada**, **Adicionada** ou **Removida**;
- modo opcional de comparação visual em baixa resolução para detectar mudanças em imagens, assinaturas e elementos gráficos;
- mostra os dois PDFs lado a lado na página selecionada;
- exibe contagem aproximada de palavras adicionadas/removidas e pequenos trechos;
- gera relatório PDF com o resumo das diferenças.

## Estratégia de alinhamento

O comparador não assume apenas que a página 10 do original corresponde sempre à página 10 da revisão. Ele procura páginas textualmente idênticas para criar âncoras e, entre essas âncoras, alinha páginas alteradas e identifica páginas extras.

Isso ajuda em cenários como:

```text
Original:  1 2 3 4 5
Revisado:  1 2 X 3 4 5
```

A página `X` é reportada como adicionada, em vez de marcar todas as páginas seguintes como modificadas.

## Comparação visual

Quando ativada, as páginas correspondentes são renderizadas localmente em resolução reduzida e os pixels são amostrados. O percentual visual é uma **estimativa de diferença**, não uma métrica pericial.

## Limitações

- PDFs digitalizados sem OCR terão pouca ou nenhuma comparação textual; use o modo visual.
- Alterações complexas de paginação podem exigir interpretação humana.
- O relatório não substitui perícia documental.
- Documentos protegidos por senha precisam ser desbloqueados antes da análise.
