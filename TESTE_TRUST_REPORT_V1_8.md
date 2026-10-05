# Teste de homologação — Document Trust Report v1.8

## Teste 1 — geração integrada

1. Abra `Preparar documento`.
2. Selecione um PDF simples de 3 ou mais páginas.
3. Mantenha `Gerar Document Trust Report` habilitado.
4. Execute pelo menos Compressão + Remover metadados.
5. Confirme que o PDF final baixa normalmente.
6. Confirme que aparece o card `DOCUMENT TRUST REPORT`.
7. Baixe `Relatório PDF` e `JSON verificável`.

Esperado:
- os dois arquivos abrem/baixam;
- o relatório contém nome, tamanho, páginas e SHA-256 do original e do resultado;
- o JSON contém `schema: pdf-studio-trust/v1`;
- o JSON contém `reportSha256` e `reportId`.

## Teste 2 — verificação positiva

1. Abra `/tool/trust-report`.
2. Selecione o PDF final do Teste 1.
3. Selecione o JSON do Teste 1.
4. Clique `Verificar Trust Report`.

Esperado:
- `Documento corresponde ao Trust Report`;
- Integridade do relatório JSON = OK;
- SHA-256 = OK;
- Tamanho = OK;
- Páginas = OK.

## Teste 3 — alteração do PDF

1. Pegue outro PDF ou modifique o PDF final.
2. Use o JSON original.
3. Verifique novamente.

Esperado:
- o sistema NÃO deve confirmar correspondência;
- pelo menos o SHA-256 deve falhar.

## Teste 4 — JSON alterado

1. Abra uma cópia do JSON em editor de texto.
2. Altere manualmente `output.sizeBytes` sem atualizar `reportSha256`.
3. Carregue o JSON alterado e o PDF correto.

Esperado:
- `Integridade do relatório JSON` deve falhar.

## Teste 5 — fingerprint sem relatório

1. Abra `/tool/trust-report`.
2. Selecione qualquer PDF.
3. Clique `Gerar fingerprint`.

Esperado:
- tamanho;
- páginas;
- SHA-256 completo;
- botão para copiar o hash.

## Teste 6 — meta X MB

1. Prepare um PDF usando `Comprimir → Para X MB`.
2. Gere Trust Report.
3. Abra o relatório.

Esperado:
- validação `Meta de tamanho` deve informar se a meta foi atingida ou se foi preservado o melhor resultado seguro.
