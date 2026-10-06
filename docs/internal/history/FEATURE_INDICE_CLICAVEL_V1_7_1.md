# PDF Studio v1.7.1 — Índice automático clicável

A ferramenta **Mesclar PDF** ganhou um índice interno gerado automaticamente.

## Como funciona

1. O usuário adiciona dois ou mais PDFs.
2. Define a ordem por drag-and-drop ou setas.
3. Mantém **Criar índice automático clicável** ativado.
4. Opcionalmente altera o título do índice.
5. O PDF Studio calcula a primeira página de cada documento.
6. Uma ou mais páginas de índice são inseridas no início.
7. Cada linha do índice é um link interno para a primeira página do respectivo documento.

Exemplo:

```text
ÍNDICE DE DOCUMENTOS

Petição Inicial ......................... 2
Procuração ............................. 19
Contrato Social ........................ 22
RG ..................................... 39
Comprovante de Residência .............. 41
Contestação ............................ 43
```

A numeração já considera as páginas extras do próprio índice.

## Integração com bookmarks

Quando **Criar marcadores automaticamente** também está ativado, o PDF final recebe:

- bookmark para o índice;
- bookmark para cada PDF de origem;
- destinos ajustados após a inserção das páginas de índice;
- `PageMode=UseOutlines` para leitores que respeitam a preferência de abertura.

## Arquivos grandes

O índice é um pós-processamento do PDF final. Para proteger a memória do navegador, resultados acima de aproximadamente 220 MB podem ser entregues sem índice/bookmarks na versão web. A mesclagem em si continua prioritária.
