# Validação v2.0

## Concluído neste pacote

- Landing page premium implementada.
- Home separada da navegação operacional: o menu lateral aparece ao entrar nas ferramentas, não na página de venda.
- Hero comercial com proposta local-first.
- Seções de fluxo, Legal / Business, Redline, privacidade e planos.
- Versão centralizada em `src/lib/appMeta.ts` e reutilizada no Trust Report/rodapé.
- Documentos e scripts históricos movidos para `docs/internal/`.
- Testes unitários, regressão PDF e Playwright adicionados.
- GitHub Actions com Quality Gate, staging e production adicionado.
- Script de release comercial adicionado.
- Arquivos `.tsbuildinfo`, caches, relatórios de teste e `release/` ignorados.
- Checagem sintática/transpilação dos arquivos TypeScript/TSX concluída no ambiente de geração.

## Dependência externa pendente de execução

O ambiente que gerou este pacote não possui conectividade com `registry.npmjs.org`. Por isso não foi possível resolver dependências para criar `package-lock.json`, executar o build Vite completo ou baixar o Chromium do Playwright.

No primeiro computador/runner com acesso ao npm:

1. execute `GERAR_PACKAGE_LOCK.bat` (ou `npm install --package-lock-only`);
2. versione `package-lock.json`;
3. execute `npm ci`;
4. execute `npm run ci`;
5. execute `npx playwright install chromium` e `npm run test:e2e`;
6. execute `CRIAR_RELEASE_COMERCIAL.bat`.

O workflow `Generate package-lock` também pode gerar o lockfile no GitHub Actions e disponibilizá-lo como artifact.
