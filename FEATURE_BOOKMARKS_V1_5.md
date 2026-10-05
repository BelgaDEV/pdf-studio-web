# v1.5.0 — Marcadores automáticos ao mesclar PDFs

A ferramenta **Mesclar PDF** agora possui a opção **Criar marcadores automaticamente**, ativada por padrão.

## Como funciona

- cada PDF de origem cria um bookmark de primeiro nível;
- o título do marcador usa o nome do arquivo sem a extensão `.pdf`;
- o marcador aponta para a primeira página daquele documento no PDF final;
- a ordem dos marcadores acompanha exatamente a ordem definida na tela de mesclagem;
- o catálogo do PDF recebe `PageMode = UseOutlines`, solicitando aos leitores compatíveis que abram o painel de marcadores.

Exemplo:

- `Petição Inicial.pdf` → marcador `Petição Inicial`
- `Contrato.pdf` → marcador `Contrato`
- `Procuração.pdf` → marcador `Procuração`

## Mesclagens grandes

Quando o qpdf/WASM é usado, a v1.5.0 preserva a ordem dos arquivos válidos e aplica os marcadores em uma etapa final. Para proteger a memória do navegador, resultados maiores que aproximadamente **220 MB** podem ser entregues sem a etapa de bookmarks. Nessa situação, a mesclagem não é descartada: a interface mostra um aviso claro.

## Teste recomendado

1. Selecione 4 PDFs com nomes fáceis de reconhecer.
2. Reordene para C → A → D → B.
3. Mantenha **Criar marcadores automaticamente** marcado.
4. Execute a mesclagem.
5. Abra o PDF em Adobe Acrobat, Edge ou outro leitor com suporte a bookmarks.
6. Confirme a ordem C → A → D → B e clique em cada marcador para validar o destino.
