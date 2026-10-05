# Homologação — Comparar PDFs v1.7.4

## Teste 1 — texto alterado
1. Crie dois PDFs iguais.
2. No revisado, troque uma frase em uma página.
3. Execute a comparação completa.
4. Esperado: uma página `Modificada`, lado a lado correto e texto adicionado/removido no relatório.

## Teste 2 — página adicionada
1. Original: páginas A, B, C, D.
2. Revisado: A, B, X, C, D.
3. Esperado: X aparece como `Adicionada`; C e D não devem virar falsas modificações apenas por terem mudado de posição.

## Teste 3 — página removida
1. Original: A, B, C, D.
2. Revisado: A, C, D.
3. Esperado: B aparece como `Removida`.

## Teste 4 — alteração somente visual
1. Use dois PDFs com o mesmo texto.
2. Altere uma imagem, assinatura ou logotipo.
3. Deixe `Comparação visual completa` ativada.
4. Esperado: página marcada como `Modificada` e percentual visual maior que zero.

## Teste 5 — PDFs idênticos
1. Compare o mesmo arquivo com uma cópia dele.
2. Esperado: 0 modificadas, 0 adicionadas e 0 removidas.

## Teste 6 — relatório
1. Após encontrar diferenças, clique em `Baixar relatório PDF`.
2. Abra o relatório.
3. Esperado: nomes dos arquivos, contagem de páginas, resumo e lista de alterações.

## Teste de privacidade
Abra DevTools > Network durante a comparação e confirme que os PDFs não são enviados a uma API do PDF Studio.
