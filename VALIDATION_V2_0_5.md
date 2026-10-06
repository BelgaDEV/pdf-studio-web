# Validação v2.0.5

## Alterações verificadas estaticamente

- versão centralizada em 2.0.5;
- jsPDF fixado em 4.2.1;
- PDF.js fixado em 6.3.289;
- Mammoth fixado em 1.13.0;
- Vitest fixado em 4.1.11;
- Wrangler removido das dependências locais;
- nenhum `getDocument()` direto fora de `pdfjsSecure.ts`;
- `isEvalSupported=false` e `enableXfa=false` aplicados no loader único;
- nenhuma instanciação de `PDFScriptingManager` no app;
- sanitização de HTML Office centralizada;
- CSP e headers adicionais incluídos;
- testes de regressão de segurança adicionados.

## Validação que depende do npm

O ambiente de empacotamento não possui acesso ao registry do npm. Após extrair no Windows, rode `npm install` para gerar/atualizar o `package-lock.json` e depois execute `npm run ci`, `npm run test:e2e`, `npm run security:prod` e `npm run security:all`.
