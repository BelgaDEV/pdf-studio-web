# PDF Studio v2.1.2

Aplicação web local-first para preparação, comparação, proteção e transformação de documentos PDF. A v2.1.2 adiciona um Quality Gate de integração no navegador: as funções críticas processam fixtures fictícias determinísticas, o arquivo gerado é reaberto e propriedades essenciais são verificadas antes de uma release.

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
npm run test:quality
npm run test:quality:ocr
```

Na primeira execução do Quality Gate instale o Chromium: `npm run quality:install`.

- `npm run test:quality`: 9 fluxos críticos determinísticos no navegador.
- `npm run test:quality:ocr`: OCR real com modelo de idioma; requer internet para obter o modelo do Tesseract quando ainda não estiver em cache.
- `npm run test:quality:full`: os 10 fluxos.
- `npm run quality:gate`: TypeScript + unitários + regressão + 9 críticos + build + performance.
- `npm run quality:gate:full`: gate completo + OCR real.

Os relatórios ficam em `quality-results/` e não são versionados.

## Release comercial

```bash
npm run build
npm run release:commercial
```

O conteúdo final fica em `release/commercial/`. No Windows, `CRIAR_RELEASE_COMERCIAL.bat` também gera `release/PDFStudio_Commercial.zip`.

A release comercial não contém histórico de desenvolvimento, scripts de atualização antigos, testes manuais ou notas de correção. Esses materiais ficam em `docs/internal/`.

## Pipeline

`.github/workflows/ci-cd.yml` implementa:

`Commit → TypeScript → Unit Tests → PDF Regression → Security → Build → Playwright UI → Quality Gate crítico → Artifact → Staging/Production`

Em tags de release e execuções manuais, o pipeline também exige o gate de OCR real antes do deploy.

- push em `develop`: pode publicar staging;
- tag `v*`: pode publicar produção;
- `workflow_dispatch`: permite escolher staging ou production;
- configure `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` como GitHub Secrets.

## Licenciamento

A configuração atual usa Ghostscript WebAssembly e declara `AGPL-3.0-or-later`. Antes de vender uma versão proprietária/fechada, revise `SOURCE_CODE_NOTICE.md` e `THIRD_PARTY_NOTICES.md` e defina a estratégia de licenciamento.
