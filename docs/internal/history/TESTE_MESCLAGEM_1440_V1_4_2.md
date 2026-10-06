# Teste — Mesclagem de 1.440 PDFs (v1.4.2)

1. Rode `npm install` e `npm run dev`.
2. Abra **Mesclar PDF**.
3. Selecione os mesmos 1.440 arquivos do teste anterior.
4. Confirme que a tela mostra **Modo seguro por lotes**.
5. Clique **Executar agora**.
6. A primeira mensagem deve aparecer imediatamente: `Modo seguro ativado: preparando 1.440 PDFs em lotes pequenos…`.
7. Depois devem aparecer `Pré-validando`, `Lote X/Y` e `Consolidando: rodada...`.
8. O app não deve tentar `qpdf carregado. Mesclando 1.440 PDFs` em uma única chamada.
9. Ao concluir, abra o PDF e valide páginas do início, meio e fim.

Se falhar, anote a mensagem que ficou persistente na caixa vermelha e o tamanho total exibido ao lado da quantidade de PDFs.
