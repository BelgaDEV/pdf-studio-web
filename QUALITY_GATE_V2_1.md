# PDF Studio v2.1.2 — Quality Gate

A v2.1 muda o critério de release: não basta a função retornar sem exceção. Os fluxos críticos processam um documento representativo, geram uma saída e a saída é reaberta/inspecionada.

## 10 fluxos cobertos

| Fluxo | Motor exercitado | Critério principal |
|---|---|---|
| Juntar PDF | pdf-lib + PDF.js | 2 entradas → 2 páginas; textos ALFA/BETA preservados |
| Dividir PDF | pdf-lib | PDF pesado → múltiplas partes; soma das páginas preservada |
| Comprimir PDF | Ghostscript WASM + qpdf | saída válida; mesma quantidade de páginas; caminho Ghostscript utilizado |
| OCR | PDF.js + Tesseract.js + pdf-lib | scan reconhecido e texto presente na camada pesquisável |
| Redação Permanente | PDF.js + canvas + pdf-lib | segredo fictício não existe mais na camada textual |
| Comparar PDFs | PDF.js + algoritmo Redline | alteração conhecida detectada e delta de palavras calculado |
| Proteger PDF | qpdf WASM AES-256 | não abre sem senha; qpdf reabre/descriptografa com a senha correta |
| PDF/A | Ghostscript WASM + PDF.js | saída reabre e preserva páginas |
| Word → PDF | DOCX + Mammoth + html2canvas + jsPDF | DOCX fictício vira PDF reabrível com pelo menos 1 página |
| Preparar Documento | qpdf + pdf-lib | metadados removidos, marca d’água e numeração presentes, páginas preservadas |

## Fixtures

Os documentos padrão são gerados em memória, com conteúdo fictício e determinístico. Isso evita colocar dados de clientes no repositório e torna o teste reproduzível.

Arquivos reais e sanitizados podem ser mantidos localmente em `tests/fixtures/private/`; essa pasta é ignorada pelo Git.

## Comandos

```bash
npm run quality:install
npm run test:quality
npm run test:quality:ocr
```

Gate completo:

```bash
npm run quality:gate:full
```

O OCR real usa o modelo `eng` do Tesseract e pode precisar de internet na primeira execução. Os demais 9 fluxos não dependem de um serviço externo de documentos.

## Relatórios

O Playwright grava JSON, HTML, traces, screenshots e vídeos de falha em `quality-results/` / `test-results/`. Esses artefatos não são versionados.

## Importante sobre PDF/A

O Quality Gate confirma que o Ghostscript conclui a conversão e que o arquivo gerado é estruturalmente reaberto, com páginas preservadas. Isso **não substitui validação normativa PDF/A** por um validador especializado como veraPDF. A interface não deve prometer conformidade certificada apenas com este teste.
