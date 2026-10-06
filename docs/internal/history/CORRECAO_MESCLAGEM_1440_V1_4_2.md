# Correção v1.4.2 — 1.440 PDFs

## Causa real encontrada

A v1.4.1 decidia entre mesclagem direta e por lotes principalmente pelo tamanho total. Assim, 1.440 PDFs pequenos que somassem menos de 256 MB ainda podiam ser enviados para **um único `qpdf.exec()`**.

O wrapper qpdf WebAssembly precisa preparar os arquivos de entrada/saída na memória do navegador/MEMFS. Com 1.440 entradas, o navegador podia esgotar/travar a memória antes de a exceção JavaScript ser capturada, fazendo a tela parecer parada.

## O que mudou

- Modo direto agora é permitido somente para até **48 arquivos e 96 MB**.
- Acima disso, o app entra **diretamente no modo seguro por lotes**.
- Cada lote inicial tem no máximo **24 PDFs ou 24 MB**.
- A consolidação dos lotes é feita em árvore, **2 PDFs intermediários por execução**.
- Adicionado `--keep-files-open=n` no qpdf.
- 1.440 PDFs nunca mais são preparados de uma vez em uma única chamada WASM.
- Progresso mostra pré-validação, lote atual e rodada de consolidação.

## Limite físico ainda existente

O resultado final precisa existir no navegador para ser baixado. Se os 1.440 PDFs somarem muitos gigabytes, qualquer solução 100% browser pode atingir o limite de memória do navegador/dispositivo. A v1.4.2 reduz drasticamente o pico de memória intermediário, mas não pode remover esse limite físico.
