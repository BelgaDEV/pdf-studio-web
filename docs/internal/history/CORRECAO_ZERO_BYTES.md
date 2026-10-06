# Correção v1.0.2 — PDF final com 0 bytes

## Causa
O PDF.js usa Web Worker e pode transferir/destacar (`detach`) o ArrayBuffer recebido.
Na v1.0.1 o compressor entregava ao PDF.js o mesmo `Uint8Array` guardado como cópia do PDF original.
Depois da transferência esse buffer podia ficar com `byteLength = 0`. Quando a rotina decidia entre
"resultado comprimido" e "original", acabava devolvendo o buffer original já destacado, gerando um Blob de 0 bytes.

## Correções
- PDF.js agora sempre recebe uma cópia independente dos bytes.
- O tamanho original usa `file.size`, que não pode ser alterado por Web Workers.
- Resultado abaixo de 100 bytes é rejeitado.
- Cabeçalho `%PDF-` é validado antes do download.
- A interface também bloqueia Blob vazio como segunda camada de segurança.
- Se a compressão não ficar menor, o original intacto é devolvido em vez de um arquivo maior/zerado.
