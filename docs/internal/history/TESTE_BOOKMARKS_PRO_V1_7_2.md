# Teste — Bookmarks Pro v1.7.2

## Teste básico

Use seis PDFs pequenos com nomes fáceis de identificar:

```text
Petição Inicial.pdf
Contestação.pdf
RG.pdf
Comprovante.pdf
Contrato Principal.pdf
Aditivo 01.pdf
```

Atribua:

```text
PETIÇÕES
  Petição Inicial.pdf
  Contestação.pdf

DOCUMENTOS
  RG.pdf
  Comprovante.pdf

CONTRATOS
  Contrato Principal.pdf
  Aditivo 01.pdf
```

Mantenha também o índice clicável ligado.

### Resultado esperado

O painel lateral deve mostrar algo semelhante a:

```text
> Índice de documentos
> PETIÇÕES
    Petição Inicial
    Contestação
> DOCUMENTOS
    RG
    Comprovante
> CONTRATOS
    Contrato Principal
    Aditivo 01
```

Clique em cada documento e confirme que o leitor abre a primeira página correta. Clique em cada categoria e confirme que ela leva ao primeiro documento do grupo.

## Teste de ordem

Reordene os arquivos fisicamente para:

```text
RG.pdf
Petição Inicial.pdf
Contrato Principal.pdf
Contestação.pdf
Comprovante.pdf
Aditivo 01.pdf
```

O conteúdo do PDF deve seguir exatamente essa ordem. A árvore lateral deve manter as categorias, com a ordem das categorias definida pela primeira aparição: `DOCUMENTOS`, `PETIÇÕES`, `CONTRATOS`.

## Teste sem categoria

Deixe um arquivo sem categoria. Ele deve aparecer como bookmark de primeiro nível, sem ser movido fisicamente.

## Teste automático

Clique em **Categorizar por nome**. Verifique se os nomes conhecidos recebem as categorias esperadas e se nomes desconhecidos continuam sem categoria.

## Teste de regressão

Desative **Bookmarks Pro hierárquicos**. A mesclagem deve voltar ao comportamento de bookmarks planos da v1.7.1.
