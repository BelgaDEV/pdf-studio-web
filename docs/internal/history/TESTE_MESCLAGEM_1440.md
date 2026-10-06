# Teste da correção de mesclagem massiva — v1.4.1

## Teste principal

1. Abra **Mesclar PDF**.
2. Selecione os mesmos 1.440 PDFs que falhavam na v1.4.0.
3. A tela deve informar **Modo de mesclagem massiva será ativado automaticamente**.
4. Para manter a interface responsiva, apenas os primeiros 200 itens aparecem inicialmente. O botão **Mostrar todos** continua disponível.
5. Clique em **Executar agora**.
6. O botão deve mudar imediatamente para **Processando…** e a caixa de progresso deve aparecer com **Preparando 1.440 PDF(s)…**.
7. Em seguida devem aparecer etapas de validação e qpdf/blocos.
8. Ao final, o navegador baixa `pdf-studio-mesclado.pdf`.

## Se houver PDF inválido/protegido

A v1.4.1 não deve parecer travada. O erro permanece visível. No modo por blocos, o sistema tenta isolar documentos problemáticos e continuar com os válidos.

## Observação de memória

A quantidade de arquivos deixou de ser tratada pelo motor simples. O limite prático passa a depender principalmente do tamanho total dos PDFs e da memória disponível no navegador. Para cargas maiores, o app usa consolidação por blocos automaticamente.
