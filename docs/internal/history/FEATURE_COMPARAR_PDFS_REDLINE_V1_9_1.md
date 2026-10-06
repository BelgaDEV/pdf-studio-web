# v1.9.1 — Comparar PDFs Redline

## Objetivo

Além da comparação lado a lado e do relatório, o PDF Studio passa a gerar um PDF de revisão marcado.

## Convenção visual

- Azul: conteúdo adicionado na versão revisada.
- Vermelho tachado: conteúdo removido, apresentado em callout porque ele não existe mais fisicamente na página revisada.
- Borda azul: página inteira adicionada.
- Página vermelha: página removida, reinserida somente no Redline para auditoria.
- Laranja: alteração visual relevante sem mudança textual detectável.

## Estratégia

O Redline usa a versão revisada como base. Para páginas modificadas, o PDF Studio extrai tokens e posições com PDF.js e aplica marcações com pdf-lib. Páginas removidas são copiadas do original e sinalizadas como removidas para que a revisão não perca contexto.

## Limitações

PDF é um formato de layout fixo, não um documento de edição como DOCX. Por isso o texto removido não pode ser simplesmente reinserido no fluxo da versão revisada sem alterar o layout. A v1.9.1 usa callouts vermelhos tachados para representar remoções. Documentos com fontes incomuns, texto rotacionado, scans sem OCR ou layouts muito complexos podem ter marcações aproximadas.
