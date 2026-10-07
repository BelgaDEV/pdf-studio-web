# PDF Studio v2.1.1 — Windows Quality Gate Hotfix

## Problema corrigido

O teste `tests/quality-gate.test.ts` usava `new URL(..., import.meta.url)` para ler arquivos locais. Sob Vitest/Vite no Windows, `import.meta.url` pode ser transformado em uma URL que não usa o esquema `file:`, fazendo `fs.readFileSync()` falhar antes de executar o Quality Gate.

## Correção

As leituras locais agora usam `process.cwd()` com `path.resolve()`. Os scripts npm e o CI já executam a partir da raiz do repositório, então esta abordagem é determinística em Windows e Linux.

Nenhum motor de PDF, OCR, Ghostscript ou qpdf foi alterado neste hotfix.

## Validação esperada

```powershell
npm install
npm run check
npm run test
npm run test:pdf
npm run test:quality
npm run build
npm run performance:bundle
npm run test:quality:ocr
```

Ou, para executar tudo em sequência:

```powershell
npm run quality:gate:full
```
