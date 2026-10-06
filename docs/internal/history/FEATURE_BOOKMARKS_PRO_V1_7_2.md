# v1.7.2 — Mesclar + Bookmarks Pro

## Objetivo

Transformar a mesclagem em uma ferramenta de montagem documental profissional. O PDF final continua respeitando a ordem física definida pelo usuário, mas o painel de bookmarks pode organizar os documentos em categorias hierárquicas.

## Fluxo

1. Adicione dois ou mais PDFs em **Mesclar PDF**.
2. Reordene os arquivos por drag-and-drop ou pelas setas.
3. Mantenha **Criar marcadores automaticamente** ligado.
4. Ative **Bookmarks Pro hierárquicos**.
5. Crie ou remova categorias conforme necessário.
6. Atribua uma categoria a cada PDF pelo seletor na própria linha do arquivo.
7. Opcionalmente use **Categorizar por nome** para aplicar sugestões automáticas.
8. Execute a mesclagem.

## Regras da hierarquia

- Um arquivo com categoria vira filho daquela categoria.
- Um arquivo sem categoria continua como bookmark de primeiro nível.
- O bookmark do índice, quando o índice clicável está ligado, permanece no primeiro nível.
- A ordem das categorias segue a primeira aparição de cada categoria na lista física de arquivos.
- Dentro de cada categoria, os documentos seguem a mesma ordem em que aparecem na lista física.
- Clicar na categoria leva ao primeiro documento daquele grupo.
- As categorias são abertas por padrão em leitores que respeitam o campo `Count` do outline PDF.

## Categorização automática

A categorização por nome é apenas uma conveniência local e não usa IA nem envia nomes a servidores. A v1.7.2 reconhece alguns padrões comuns:

- `petição`, `contestação`, `recurso`, `réplica`, `manifestação`, `embargo`, `agravo`, `apelação`, `contrarrazões` → **PETIÇÕES**;
- `contrato`, `aditivo`, `instrumento`, `termo de acordo` → **CONTRATOS**;
- `RG`, `CPF`, `CNH`, `comprovante`, `certidão`, `procuração`, `identidade` → **DOCUMENTOS**.

Arquivos que não correspondem a uma regra permanecem sem categoria para evitar classificações incorretas.

## Compatibilidade

Os bookmarks são gravados usando a estrutura `Outlines` do PDF. Adobe Acrobat Reader e navegadores/leitores modernos devem reconhecer a árvore. O comportamento visual de expansão automática pode variar por leitor.
