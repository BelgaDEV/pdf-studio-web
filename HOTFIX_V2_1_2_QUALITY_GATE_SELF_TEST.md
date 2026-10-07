# PDF Studio v2.1.2 — Quality Gate Self-Test Hotfix

## Problema
A v2.1.1 corrigiu o uso de `import.meta.url` no Windows, porém o teste de wiring procurava no próprio arquivo pela string antiga proibida. Como a string aparecia dentro da própria asserção `not.toContain(...)`, o teste falhava mesmo com a implementação correta.

## Correção
O teste agora valida diretamente os caminhos nativos gerados por `process.cwd()` + `path.resolve()` e confirma que `package.json` e `tests/quality/browserHarness.ts` podem ser lidos, sem fazer busca autorreferente por texto.

## Escopo
Nenhum motor de PDF, OCR, Ghostscript, qpdf, segurança ou UI foi alterado.
