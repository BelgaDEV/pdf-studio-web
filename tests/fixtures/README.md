# Quality Gate fixtures

A v2.1 gera fixtures fictícias determinísticas no próprio navegador para evitar armazenar documentos de clientes no repositório.

A suíte cobre:

- PDFs de texto com cláusulas e dados fictícios;
- PDF com imagens pesadas para divisão e compressão;
- página rasterizada de alto contraste para OCR;
- DOCX fictício criado em memória;
- PDF com metadados para Preparar Documento;
- conteúdo sensível fictício para Redação Permanente.

## Arquivos reais/sanitizados

Para regressões específicas de produção, coloque cópias **sanitizadas e sem dados pessoais** em `tests/fixtures/private/`. Essa pasta é ignorada pelo Git e nunca deve receber documentos de clientes sem autorização e anonimização.

Os fixtures privados são complementares. O Quality Gate padrão não depende deles e permanece reproduzível em qualquer máquina.
