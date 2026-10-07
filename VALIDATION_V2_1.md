# PDF Studio v2.1.2 — Validation

## Mudanças de qualidade

- adicionada suíte Playwright dedicada em `tests/quality/`;
- 9 fluxos críticos determinísticos executados em Chromium real;
- OCR real separado como gate online, totalizando 10 fluxos;
- fixtures são geradas em memória e não contêm dados pessoais;
- relatórios JSON/HTML e traces são produzidos quando o gate roda;
- CI executa os 9 casos centrais em toda mudança e exige OCR real em tags/releases ou execução manual;
- `extractPdfText()` agora encerra corretamente o PDFDocumentLoadingTask;
- validação de saída PDF/A também encerra o PDF.js após a verificação.

## Validação local esperada

```bash
npm install
npm run check
npm run test
npm run test:pdf
npm run build
npm run performance:bundle
npm run quality:install
npm run test:quality
npm run test:quality:ocr
```

Resultado-alvo:

- TypeScript: 0 erros;
- unit/security: todos verdes;
- regressão PDF: verde;
- Quality core: 9/9 fluxos;
- Quality OCR: 1/1 fluxo;
- Critical/High npm audit: 0;
- build de produção: concluído;
- motores pesados continuam fora do grafo inicial da Home.

## Validação executada durante a geração deste pacote

- 60 arquivos TS/TSX do repositório interno: transpile/sintaxe sem erros;
- 45 arquivos TS/TSX do Commercial Source: transpile/sintaxe sem erros;
- `package.json` válido e versão centralizada em 2.1.2;
- os 10 casos estão registrados no browser harness;
- o ambiente de geração não conseguiu concluir `npm install` por indisponibilidade do registry, portanto a execução real de Chromium/Ghostscript/qpdf/Tesseract deve ser feita pelo `INSTALAR_E_TESTAR.bat` na máquina de validação antes do deploy.
