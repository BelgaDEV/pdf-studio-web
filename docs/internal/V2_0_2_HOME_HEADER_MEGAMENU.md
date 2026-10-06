# v2.0.2 — Home, Header e Mega Menu

## Objetivo

Reduzir o tempo entre a entrada no site e a escolha da ferramenta, mantendo abaixo da grade a narrativa premium de Redline, privacidade e planos.

## Hierarquia visual

1. Header de largura total
   - PDF Studio
   - Juntar PDF
   - Dividir PDF
   - Comprimir PDF
   - Converter PDF
   - Todas as ferramentas
   - Comparar PDF
   - Ajuda
   - Preparar documento

2. Hero curto
   - mensagem principal
   - busca de ferramentas
   - filtros por categoria

3. Grade de ferramentas
   - começa pelas tarefas de uso mais frequente
   - depois mostra conversão, OCR, segurança e ferramentas profissionais

4. Blocos de venda
   - Legal Redline
   - Privacidade por arquitetura
   - Free / Pro Legal / Business

5. CTA final e rodapé

## Mega menu

`Todas as ferramentas` abre um painel de 5 colunas por hover ou foco de teclado.

### Organizar PDF
- Juntar PDF
- Dividir PDF
- Organizar páginas
- Editar páginas
- Numeração de páginas

### Converter PDF
- PDF para Word
- Word para PDF
- PDF para JPG
- PDF para PNG
- Imagens para PDF

### Otimizar PDF
- Comprimir PDF
- OCR pesquisável
- Remover páginas em branco
- Extrair imagens
- PDF para TXT

### Editar e proteger
- Marca d'água
- Remover metadados
- Proteger com senha
- PDF para PDF/A
- Redação permanente

### Profissional
- Comparar PDFs
- Preparar documento
- Presets Tribunal
- Document Trust Report
- Processamento em lote

## Ordem inicial da Home

A grade deixou de seguir a ordem técnica do array `tools` e agora usa `homePriority`. Assim, recursos avançados como Trust Report e Presets Tribunal não aparecem antes das tarefas básicas.

Primeira sequência:

`Juntar → Dividir → Comprimir → Organizar → PDF para Word → Word para PDF → PDF para JPG → Imagens para PDF → OCR → Proteger`

Depois entram edição, conversores adicionais e ferramentas profissionais.

## Responsividade

- Desktop amplo: navegação distribuída por toda a largura e mega menu em 5 colunas.
- Até 1420px: gaps e tipografia reduzem automaticamente.
- Abaixo de 1180px: navegação desktop é substituída pelo menu mobile.
- A grade da Home mantém os breakpoints existentes.
