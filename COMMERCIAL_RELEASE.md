# Release comercial

A distribuição pública não deve carregar histórico de desenvolvimento, scripts de atualização de versões antigas, notas de correção ou arquivos de validação manual.

## O que entra

- `dist/` — aplicação compilada
- `README_COMERCIAL.md` — instruções de implantação
- `THIRD_PARTY_NOTICES.md` — avisos das bibliotecas utilizadas
- `SOURCE_CODE_NOTICE.md` — lembrete de obrigações de licenciamento da versão atual
- `VERSION` — versão exata da release

## O que fica somente no repositório interno

- `src/`, `tests/`, `.github/`
- `docs/internal/`
- `ATUALIZAR_*.bat` históricos
- `TESTE_*.md`, `CORRECAO_*.md`, `FEATURE_*.md`, `VALIDACAO_*.txt`
- arquivos `.tsbuildinfo`, caches, `node_modules`

## Gerar

1. Instale as dependências.
2. Execute `npm run ci`.
3. Execute `npm run release:commercial`.
4. A saída ficará em `release/commercial/`.

No Windows, `CRIAR_RELEASE_COMERCIAL.bat` executa o processo e cria um ZIP.
