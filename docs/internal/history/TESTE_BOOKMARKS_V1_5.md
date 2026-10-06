# Teste de homologação — bookmarks v1.5.0

1. Separe quatro PDFs: `A.pdf`, `B.pdf`, `C.pdf`, `D.pdf`.
2. Em **Mesclar PDF**, reordene para `C → A → D → B`.
3. Confirme que **Criar marcadores automaticamente** está marcado.
4. Execute a mesclagem e abra `pdf-studio-mesclado.pdf`.
5. Abra o painel de marcadores/bookmarks do leitor de PDF.
6. Valide a ordem: `C`, `A`, `D`, `B`.
7. Clique em cada marcador e confirme que ele leva à primeira página do respectivo arquivo.
8. Repita desmarcando a opção e confirme que o PDF é mesclado sem criar a nova árvore de marcadores.

## Teste com nomes reais

Use também arquivos com acentos e caracteres comuns em documentos jurídicos, por exemplo:

- `Petição Inicial.pdf`
- `Procuração - João da Silva.pdf`
- `Comprovante de Residência.pdf`
- `Anexo 01 - Contrato.pdf`

Os títulos devem aparecer corretamente em Unicode no painel do leitor.

## Mesclagem grande

Para 100+ PDFs, confira no progresso as etapas de mesclagem e depois `Mapeando marcadores` / `Criando marcadores de navegação`. Se o PDF final superar ~220 MB, a versão web pode omitir a etapa de bookmarks para proteger a memória; essa condição deve aparecer como aviso, sem descartar a mesclagem.
