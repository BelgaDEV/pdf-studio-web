# Validação — PDF Studio v2.0.2

## Escopo desta versão

- Header da landing passa a ocupar toda a largura útil, reduzindo o espaço vazio entre a marca e a navegação.
- `Todas as ferramentas` virou um mega menu com as 25 ferramentas atuais, agrupadas em 5 colunas.
- O mega menu abre por hover e `focus-within`, mantendo navegação por teclado.
- `Pro Legal` no header foi substituído por `Comparar PDF`, com acesso direto ao Redline.
- A grade inicial da Home foi reordenada para colocar ferramentas de uso diário antes dos recursos avançados.
- `Mesclar PDF` foi renomeado visualmente para `Juntar PDF` para manter consistência com o header e linguagem mais direta.
- O mobile mantém navegação compacta e inclui `Comparar PDF` como atalho direto.
- Testes E2E da landing foram atualizados para cobrir a experiência tool-first e o mega menu.

## Estrutura do mega menu

1. Organizar PDF
2. Converter PDF
3. Otimizar PDF
4. Editar e proteger
5. Profissional

Cada coluna contém 5 ferramentas, totalizando as 25 ferramentas disponíveis na versão atual.

## Validações realizadas neste pacote

- Integridade da lista: 25 ferramentas cadastradas.
- Mega menu: 25 IDs únicos, sem ferramentas faltantes ou duplicadas.
- Prioridade da Home: 25 IDs únicos, sem ferramentas faltantes.
- Parse/transpilação sintática: 35 arquivos `.ts/.tsx`, sem erro sintático.
- Versão central atualizada para `2.0.2`.

## Validação completa recomendada após `npm install`

```bash
npm run check
npm run test
npm run test:pdf
npm run build
npm run test:e2e
```

O `package-lock.json` deve ser preservado após a instalação no ambiente de desenvolvimento e versionado no repositório.
