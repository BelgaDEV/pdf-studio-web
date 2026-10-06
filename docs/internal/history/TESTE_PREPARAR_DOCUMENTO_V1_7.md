# Testes — Preparar Documento v1.7.0

## Teste 1 — fluxo padrão

- Selecione um PDF comum.
- Mantenha Remover páginas em branco, Compressão Inteligente e Remover metadados ligados.
- Execute.
- Confirme que as três etapas ficam verdes/OK.
- Abra o PDF baixado.

## Teste 2 — OCR

- Use um PDF escaneado.
- Ligue OCR em Português / 180 DPI.
- Execute.
- Abra o resultado e teste Ctrl+F por uma palavra visível no scan.

## Teste 3 — acabamento

- Ligue marca d’água e numeração.
- Use uma marca como CONFIDENCIAL.
- Confirme marca e numeração em páginas do início, meio e fim.

## Teste 4 — PDF/A

- Ligue PDF/A-2b como última etapa.
- Confirme que o arquivo final abre normalmente.
- Para uso oficial, faça validação PDF/A externa.

## Teste 5 — pipeline completa

Ative:

- Remover páginas em branco
- Comprimir Inteligente
- OCR
- Remover metadados
- Marca d’água
- Numeração
- PDF/A-2b

Confirme que o painel executa as etapas na ordem exibida e que o relatório final lista todas as operações.

## Teste 6 — erro controlado

- Use Comprimir para X MB.
- Informe uma meta impossível para o arquivo.
- Confirme que a interface informa que a etapa Compressão falhou, sem apresentar falso sucesso.
