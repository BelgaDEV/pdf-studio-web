# PDF Studio v2.0.7 — Regression Harness Hotfix

## Correções

- Corrige o teste `tests/pdf-regression.test.ts`: `removePdfMetadata()` retorna `{ bytes, engine }`, portanto o PDF deve ser reaberto com `output.bytes`.
- Isola o PDF.js nesse teste de Node para não carregar desnecessariamente o build de navegador nem emitir o aviso de `legacy` build.
- Evita importar `@wasm-zoo/qpdf` em ambiente Node/SSR, onde o pacote de navegador referencia `window`.
- Em Node/SSR a remoção de metadados usa deliberadamente o fallback `pdf-lib`; no navegador, qpdf permanece como motor principal com fallback para `pdf-lib`.
- Mantém integralmente o Security Hardening e o layout da v2.0.6.

## Resultado esperado

```text
npm run check     -> sem erros
npm run test      -> 9 testes aprovados
npm run test:pdf  -> 1 teste aprovado
npm run build     -> build concluído
```

Os avisos `moderate` do npm audit são independentes deste hotfix e devem ser avaliados separadamente.
