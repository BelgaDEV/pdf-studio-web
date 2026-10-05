# Mesclar PDFs — ordenação por arrastar e soltar (v1.3.1)

A tela **Mesclar PDF** agora permite definir a ordem do documento final antes de executar a operação.

## Como funciona

1. Adicione dois ou mais PDFs.
2. A lista mostra explicitamente as posições **1, 2, 3...**.
3. No desktop, arraste qualquer card e solte sobre a posição desejada.
4. Em dispositivos touch/celular, use os botões **↑** e **↓** como alternativa confiável.
5. Clique em **Executar agora**.

A função `mergePdfs()` já processa os arquivos na ordem recebida pela lista. Portanto, a ordem visual exibida é exatamente a ordem gravada no PDF final.

Durante o processamento a reorganização e remoção ficam desabilitadas para impedir mudança de ordem no meio da mesclagem.
