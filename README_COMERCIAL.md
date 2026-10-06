# PDF Studio — distribuição comercial

Esta pasta contém somente os artefatos necessários para publicar a aplicação web.

## Publicação

O conteúdo servido ao usuário está em `dist/`. Publique essa pasta em um host de arquivos estáticos ou através do Cloudflare Workers configurado no repositório interno.

## Privacidade

O fluxo principal de processamento de PDFs ocorre no navegador do usuário. Antes de cada release, valide a aba Network do navegador e os testes automatizados para garantir que nenhuma alteração introduziu upload de documentos.

## Licenciamento

A versão atual utiliza Ghostscript WebAssembly e está marcada como `AGPL-3.0-or-later`. Revise `SOURCE_CODE_NOTICE.md` e `THIRD_PARTY_NOTICES.md` antes de comercializar, redistribuir ou operar uma versão fechada.
