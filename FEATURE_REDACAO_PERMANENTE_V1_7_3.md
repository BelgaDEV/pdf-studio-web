# v1.7.3 — Redação permanente

Nova ferramenta Legal / Business para remover conteúdo sensível de forma visual e permanente.

## Fluxo

1. Selecione um PDF.
2. Navegue pelas páginas.
3. Arraste retângulos sobre CPF, CNPJ, nomes, endereços, valores ou qualquer conteúdo sensível.
4. Revise as áreas pretas na prévia.
5. Clique em **Aplicar redações permanentemente**.
6. O PDF Studio reconstrói apenas as páginas que receberam redação.
7. Antes do download, as páginas redigidas são verificadas para confirmar ausência de camada de texto extraível.

## Modelo de segurança

A ferramenta não adiciona um simples retângulo preto sobre o PDF original. Em cada página redigida:

- a página é renderizada para imagem em 150, 200 ou 300 DPI;
- as áreas marcadas são pintadas em preto nos pixels renderizados;
- o conteúdo original da página não é copiado para o PDF de saída;
- uma nova página contendo somente a imagem já redigida é criada.

Dessa forma, texto, vetores, links, comentários ou objetos que existiam sob a tarja não ficam escondidos no conteúdo da página final.

## Preservação

Páginas sem qualquer marcação continuam sendo copiadas do PDF original, preservando texto/vetores nessas páginas.

## Limitações deliberadas

Nas páginas que receberam redação:

- texto deixa de ser selecionável/pesquisável;
- links são achatados;
- formulários e anotações são achatados/removidos;
- bookmarks documentais existentes não são preservados nesta primeira versão.

Essas perdas são deliberadas para priorizar a remoção permanente do conteúdo.
