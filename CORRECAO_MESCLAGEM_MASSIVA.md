# Correção v1.4.1 — Mesclagem massiva

A tela **Mesclar PDF** agora possui um caminho específico para grandes volumes (100+ arquivos ou 128 MB+).

## O que mudou

- 1.440 PDFs não são mais enviados ao algoritmo simples do `pdf-lib`.
- Até ~256 MB totais, a mesclagem massiva tenta qpdf WebAssembly diretamente.
- Volumes maiores usam blocos com limite de quantidade/tamanho e consolidação em árvore.
- A interface mostra progresso desde o início, inclusive durante preparação/validação.
- Erros agora permanecem visíveis na tela; não desaparecem quando o processamento termina.
- Arquivos com cabeçalho inválido, corrompidos ou incompatíveis podem ser isolados no modo por blocos sem derrubar toda a fila.
- O resultado vazio é bloqueado antes do download.

## Observação

O processamento continua 100% local. Como WebAssembly usa memória do navegador, o limite prático depende do tamanho total dos PDFs e da RAM disponível, não apenas da quantidade de arquivos.
