# PDF Studio v2.0.8 — Validation

Esta versão mantém as correções visuais e de segurança anteriores e adiciona code splitting/lazy loading.

## Gates
1. `npm run check`
2. `npm run test`
3. `npm run test:pdf`
4. `npm run security` — falha somente em high/critical; os 3 moderates transitivos conhecidos do Mammoth permanecem documentados.
5. `npm run build`
6. `npm run performance:bundle`

## Resultado esperado
- 0 High / 0 Critical de produção.
- Home sem motores pesados no grafo estático.
- Ghostscript e qpdf WebAssembly somente sob demanda.
- PDF.js/worker somente quando preview/render/inspeção for necessária.
- Tesseract somente ao executar OCR.
- Pilha Word separada por direção de conversão.
