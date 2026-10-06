# PDF Studio v2.0.8 — Performance / Lazy Loading

## Objetivo
A Home deve carregar apenas a interface necessária para navegação. Motores de PDF, OCR, Word e WebAssembly só são requisitados quando a ação correspondente é usada.

## Alterações
- Rotas `/tool/:id`, FAQ, Roadmap e Workflows agora usam `React.lazy`.
- Ferramentas avançadas dentro de `ToolPage` também são carregadas sob demanda.
- `ToolPage` não possui mais imports estáticos de `pdf.ts`, `word.ts` ou `jszip`.
- PDF.js foi retirado do import estático de `pdf.ts` e `documentTools.ts`.
- Preview/inspeção foi isolado em `pdfPreview.ts`.
- Ghostscript/qpdf continuam atrás de imports dinâmicos e não entram no grafo inicial.
- Tesseract continua sendo carregado somente ao executar OCR.
- Mammoth, html2canvas, jsPDF e docx agora são carregados por operação, não juntos.
- JSZip passa a ser carregado somente nas operações que realmente geram ZIP.
- O build gera `dist/.vite/manifest.json` e `npm run performance:bundle` valida o grafo estático inicial.

## Regra de performance
O script falha se detectar Ghostscript, qpdf, PDF.js, Tesseract, Mammoth, jsPDF, html2canvas ou docx no grafo estático do entrypoint.

## Validação no Windows
```powershell
npm install
npm run check
npm run test
npm run test:pdf
npm run build
npm run performance:bundle
```

Depois abra DevTools > Network, marque "Disable cache", recarregue a Home e confirme que `gs-core*.wasm`, `qpdf-core*.wasm`, `pdf.worker*.mjs` e assets de OCR não são baixados até uma ferramenta que precise deles ser acionada.
