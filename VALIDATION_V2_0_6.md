# Validação v2.0.6

Hotfix de compatibilidade com PDF.js 6.3.289.

- remove uso de `PDFDocumentProxy.destroy()`, removido no PDF.js 6;
- gerencia `PDFDocumentLoadingTask` via `WeakMap` e `destroyPdfJsDocument`;
- remove `isEvalSupported` de `DocumentInitParameters`, não aceito pela tipagem atual;
- mantém `enableXfa: false` e não instancia `PDFScriptingManager`;
- corrige narrowing de `File | Uint8Array | ArrayBuffer`;
- adiciona teste de regressão específico para API do PDF.js 6;
- preserva todas as alterações visuais da v2.0.4/v2.0.5.
