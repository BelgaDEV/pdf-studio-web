# PDF Studio v1.7.0 — Legal / Business

A v1.7 inicia a camada Legal / Business pelo recurso **Preparar documento**.

## Objetivo

Executar várias operações em um único fluxo, sem obrigar o usuário a baixar e reenviar o PDF entre ferramentas.

## Ordem do pipeline

1. Remover páginas em branco
2. Comprimir
3. OCR pesquisável
4. Remover metadados
5. Marca d’água
6. Numeração de páginas
7. Converter para PDF/A

A ordem é deliberada. A compressão ocorre antes do OCR para que, caso seja necessário rasterizar páginas, a camada pesquisável seja reconstruída posteriormente. PDF/A fica por último para evitar alterar o arquivo depois da conversão de arquivamento.

## Recursos

- Cada etapa pode ser ativada/desativada.
- Progresso geral e progresso visual por etapa.
- Falhas identificam exatamente em qual etapa ocorreram.
- O documento final é validado antes do download.
- Relatório final mostra tamanho, número de páginas e resultado de cada etapa.
- Todo o documento continua sendo processado localmente no navegador.

## Próximas entregas planejadas para Legal / Business

- Índice automático clicável
- Mesclar + bookmarks hierárquicos
- Redação permanente
- Comparar PDFs
- Presets Tribunal / Empresa
