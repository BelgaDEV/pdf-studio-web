# Correção de mesclagem massiva — v1.4.3

A v1.4.2 ainda mantinha todos os PDFs intermediários dos lotes em memória. Em um teste com 1.440 PDFs / ~565 MB, isso podia elevar o pico de memória para mais de 1 GB e travar a aba antes mesmo de a interface continuar atualizando.

## O que mudou

- Modo Ultra usa OPFS para guardar intermediários no armazenamento local do navegador.
- Cada lote é persistido e a referência em RAM pode ser liberada.
- Na consolidação, apenas dois intermediários são lidos por vez.
- Entradas intermediárias já consumidas são apagadas do OPFS.
- O `Uint8Array` retornado pelo qpdf não é clonado.
- Há timeout de 45 s na inicialização do qpdf com erro visível.
- A interface ganhou “Detalhes da mesclagem”, mostrando cada etapa.

## Navegadores

Para mesclagens grandes, use Chrome ou Edge atualizados em HTTPS ou localhost. O OPFS é necessário para trabalhos muito grandes.
