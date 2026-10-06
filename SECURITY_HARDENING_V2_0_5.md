# PDF Studio v2.0.5 — Security Hardening

Esta versão mantém a interface da v2.0.4 e endurece a cadeia de processamento de documentos não confiáveis.

## Dependências atualizadas

- `jspdf`: 4.2.1
- `pdfjs-dist`: 6.3.289
- `mammoth`: 1.13.0
- `vitest`: 4.1.11
- `wrangler`: removido das dependências locais; o deploy continua via `cloudflare/wrangler-action` no CI/CD.

As versões críticas de segurança estão fixadas sem `^` para reduzir drift acidental.

## PDF.js

Todo carregamento passa por `src/lib/pdfjsSecure.ts`.

- `isEvalSupported: false`
- `enableXfa: false`
- o app não instancia `PDFScriptingManager` nem o viewer genérico; `enableScripting` permanece desabilitado por política
- CSP bloqueia scripts não pertencentes ao próprio aplicativo

## DOCX / Mammoth

O HTML convertido é sempre passado por `sanitizeOfficeHtml()` antes de entrar no DOM. Conteúdo ativo como `script`, `iframe`, `object`, formulários e atributos perigosos é removido.

## Headers

A release inclui CSP, proteção contra framing, HSTS, nosniff, Referrer-Policy, Permissions-Policy e políticas de origem compatíveis com WebAssembly. `script-src` permanece restrito ao próprio app; apenas as origens de modelo do Tesseract são autorizadas em `connect-src`/`worker-src` para OCR.

## Auditoria

Após `npm install`, execute:

```powershell
npm run check
npm run test
npm run test:pdf
npm run build
npm run security:prod
npm run security:all
```

O objetivo de release é zero vulnerabilidades `high` ou `critical`. Avisos `moderate` transitivos devem ser avaliados individualmente e não ignorados automaticamente com `npm audit fix --force`.
