# PDF Studio v2.0.8

Aplicação web local-first para preparação, comparação, proteção e transformação de documentos PDF. A v2.0.8 mantém a interface premium e o Security Hardening das versões anteriores e adiciona Performance / Lazy Loading: a Home carrega apenas a camada de interface, enquanto PDF.js, Ghostscript, qpdf, OCR e conversores pesados são carregados sob demanda. O projeto também mantém a separação entre repositório interno e release comercial.

## Desenvolvimento

Requer Node.js 22 ou 24 (`>=22 <25`).

```bash
npm install
npm run dev
```

Após o primeiro `npm install`, versione o `package-lock.json`. Em Windows, `GERAR_PACKAGE_LOCK.bat` pode ser usado somente para gerar/atualizar o lockfile.

## Qualidade

```bash
npm run check
npm run test
npm run test:pdf
npm run security
npm run build
npm run performance:bundle
npm run test:e2e
```

`npm run ci` executa TypeScript, testes unitários, regressão PDF, build e validação do grafo de carregamento inicial. O Playwright fica separado porque instala um navegador próprio no CI.

## Release comercial

```bash
npm run build
npm run release:commercial
```

O conteúdo final fica em `release/commercial/`. No Windows, `CRIAR_RELEASE_COMERCIAL.bat` também gera `release/PDFStudio_Commercial.zip`.

A release comercial não contém histórico de desenvolvimento, scripts de atualização antigos, testes manuais ou notas de correção. Esses materiais ficam em `docs/internal/`.

## Pipeline

`.github/workflows/ci-cd.yml` implementa:

`Commit → TypeScript → Unit Tests → PDF Regression → Security → Build → Playwright → Artifact → Staging/Production`

- push em `develop`: pode publicar staging;
- tag `v*`: pode publicar produção;
- `workflow_dispatch`: permite escolher staging ou production;
- configure `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` como GitHub Secrets.

## Licenciamento

A configuração atual usa Ghostscript WebAssembly e declara `AGPL-3.0-or-later`. Antes de vender uma versão proprietária/fechada, revise `SOURCE_CODE_NOTICE.md` e `THIRD_PARTY_NOTICES.md` e defina a estratégia de licenciamento.
