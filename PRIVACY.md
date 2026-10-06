# Arquitetura de privacidade

O produto adota uma arquitetura local-first: os documentos selecionados são processados no navegador sempre que a ferramenta utilizada permitir.

A aplicação comercial deve manter uma separação clara entre:

- conteúdo dos documentos — permanece no dispositivo;
- autenticação/licenciamento — pode futuramente usar backend próprio;
- telemetria — quando implementada, deve excluir nomes de arquivos, texto extraído e conteúdo dos PDFs.

Qualquer funcionalidade futura que altere esse comportamento deve informar o usuário de forma explícita antes do processamento.
