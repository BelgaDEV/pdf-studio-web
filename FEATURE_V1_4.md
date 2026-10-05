# PDF Studio v1.4 — pacote de produtividade

## 1. Organizador visual de páginas

Rota: `/tool/organize`

- Renderiza miniaturas localmente com PDF.js.
- Arraste e solte para mudar a ordem.
- Setas esquerda/direita funcionam como alternativa em touch/mobile.
- Exclua páginas.
- Selecione várias páginas e exporte somente a seleção.
- Baixe o PDF reorganizado preservando as páginas originais com pdf-lib.

## 2. OCR pesquisável

Rota: `/tool/ocr`

- Idiomas: Português, Inglês, Português + Inglês.
- Perfis de 150, 180 e 220 DPI.
- Opção para pular páginas que já possuem texto.
- Renderiza a página para o OCR, mas preserva a página PDF original no resultado.
- Adiciona uma camada de texto invisível e pesquisável sobre cada página escaneada.
- O documento não é enviado para um servidor de OCR.

## 3. Processamento em lote

Rota: `/tool/batch`

- Aceita vários PDFs.
- Processa sequencialmente para evitar picos de RAM.
- Modos Inteligente, Básico, Médio, Alto, Máximo e Para X MB cada.
- Exibe status individual por arquivo.
- Gera ZIP com todos os resultados e `relatorio-processamento.txt`.

## 4. Editor básico de páginas

Rota: `/tool/edit-pages`

- Miniaturas visuais.
- Reordenar por drag-and-drop.
- Girar 90° à esquerda/direita.
- Duplicar página.
- Excluir página.
- Exportar o documento editado.

## Proteções

- Nenhuma operação permite exportar um documento com zero páginas.
- Saídas vazias são bloqueadas.
- O editor trabalha sobre cópias das páginas do PDF original.
- OCR encerra o Web Worker ao finalizar para liberar memória.
