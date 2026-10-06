# v1.9 — Workflows Salvos + Favoritos + Recentes

## Workflows salvos

A nova rota `/workflows` permite criar e reutilizar configurações do **Preparar documento**. Cada workflow guarda somente configurações, nunca o PDF.

Modelos incluídos:

- Protocolo jurídico
- Arquivo pesquisável
- Compartilhamento seguro
- Processo numerado

Etapas configuráveis:

- remover páginas em branco
- compressão, inclusive meta X MB
- OCR e idioma
- remoção de metadados
- marca d'água
- numeração
- PDF/A
- Document Trust Report

O usuário pode criar, duplicar, editar e excluir workflows personalizados. Eles são armazenados em `localStorage`.

## Favoritos

Cada ferramenta possui uma estrela no menu lateral. Até 12 favoritos ficam persistidos no navegador e aparecem em uma área dedicada no topo do menu.

## Recentes

Ao visitar uma ferramenta, seu ID é colocado na lista de recentes. São mantidas até 8 ferramentas. Não são armazenados nome do PDF, conteúdo, hash, tamanho ou qualquer dado do documento.

## Integração com Preparar documento

Um workflow pode ser aplicado diretamente ao `Preparar documento`. Também é possível salvar a configuração atualmente selecionada como um novo workflow sem sair da tela.
