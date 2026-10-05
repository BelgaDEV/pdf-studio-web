# Teste — Índice automático clicável v1.7.1

## Teste principal

Use quatro PDFs fáceis de identificar:

- A - Petição Inicial.pdf — 3 páginas
- B - Procuração.pdf — 2 páginas
- C - Contrato.pdf — 4 páginas
- D - RG.pdf — 1 página

Reordene para:

1. C - Contrato
2. A - Petição Inicial
3. D - RG
4. B - Procuração

Mantenha ativados:

- Criar marcadores automaticamente
- Criar índice automático clicável

Título: `Índice de documentos`

## Resultado esperado

Com 1 página de índice, as páginas iniciais físicas devem ser:

- Contrato → página 2
- Petição Inicial → página 6
- RG → página 9
- Procuração → página 10

Clique em cada linha do índice e confirme que o leitor pula para a primeira página correta.

Abra também o painel lateral de bookmarks e confirme a ordem:

1. Índice de documentos
2. C - Contrato
3. A - Petição Inicial
4. D - RG
5. B - Procuração

## Teste multipágina

Mescle pelo menos 60 PDFs. O índice deve ocupar mais de uma página, mantendo todos os links corretos.

## Teste sem bookmarks

Desative apenas os bookmarks e mantenha o índice. O índice deve continuar clicável normalmente.

## Teste sem índice

Desative o índice e mantenha os bookmarks. O comportamento da v1.5 deve continuar funcionando.
