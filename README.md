# PDF Studio Web Client v1.9.1


## v1.9.1 — Comparar PDFs Redline

O Comparar PDFs agora pode gerar um novo PDF marcado para revisão: adições são destacadas em azul, remoções aparecem em vermelho tachado em callouts, páginas adicionadas recebem borda azul, páginas removidas são mantidas com marcação vermelha e mudanças apenas visuais recebem sinalização laranja. O documento marcado preserva as páginas do PDF revisado e reinsere páginas removidas apenas para auditoria da comparação.


## v1.9.0 — Workflows Salvos + Favoritos + Recentes

- Nova página **Workflows salvos** em `/workflows`, com modelos prontos e workflows personalizados persistidos no navegador.
- O usuário pode salvar a configuração atual de **Preparar documento** como workflow reutilizável.
- Workflows podem combinar limpeza, compressão, OCR, remoção de metadados, marca d’água, numeração, PDF/A e Document Trust Report.
- **Favoritos** no menu lateral para acesso rápido às ferramentas mais usadas.
- **Recentes** mostra as últimas ferramentas abertas, sem armazenar nomes ou conteúdo dos documentos.
- Home passa a exibir acesso rápido a Favoritos/Recentes e um atalho destacado para Workflows.

Veja `FEATURE_WORKFLOWS_FAVORITOS_RECENTES_V1_9.md`.


## v1.8.4 — Layout Cleanup

- Home mais compacta: redução do espaço vazio entre a navegação superior e o hero.
- Roadmap simplificado: removidos Maturidade, Limitações conhecidas, Próximos passos e Monetização.
- Roadmap agora foca em posicionamento + histórico de versões entregues.
- Textos da Home e FAQ atualizados para refletir a estrutura nova.


**Navigation & Product Experience:** menu lateral global com busca, Central de Ajuda/FAQ e Roadmap consolidado do produto.

Veja `FEATURE_NAVIGATION_FAQ_ROADMAP_V1_8_2.md` e `PRODUCT_ROADMAP_V1_8_2.md`.

## Correção v1.8.1 — botão Preparar documento

- Corrige o botão de execução que podia ficar abaixo da área visível em telas menores.
- O painel de preparação agora possui rolagem própria no desktop.
- A barra de execução permanece fixada na parte inferior do painel enquanto o usuário revisa as opções.
- Em tablet/mobile, o layout volta ao fluxo normal da página.


## Novidade da v1.8.1 — Document Trust Report

A v1.8 adiciona uma camada de integridade e rastreabilidade ao fluxo **Preparar documento**. Ao final do processamento, o PDF Studio pode gerar um relatório técnico com SHA-256 do original e do resultado, tamanhos, páginas, etapas executadas, validações e o preset aplicado.

Dois arquivos podem ser baixados:

- **Relatório PDF** para leitura e auditoria humana.
- **JSON verificável** no schema `pdf-studio-trust/v1`.

A nova ferramenta **Document Trust Report** (`/tool/trust-report`) recebe o PDF final + o JSON e recalcula localmente o hash SHA-256, tamanho e quantidade de páginas. Também valida o SHA-256 interno do próprio payload do relatório. Se todos os dados coincidirem, o PDF Studio confirma que o PDF corresponde ao relatório carregado.

A ferramenta também gera um **Document Fingerprint** de qualquer PDF sem exigir relatório anterior.

Importante: esta versão é um registro técnico local e não substitui assinatura digital ICP-Brasil, carimbo do tempo, certificação jurídica, perícia ou validação normativa de PDF/A. O JSON ainda não é assinado por uma autoridade externa.

Veja `FEATURE_TRUST_REPORT_V1_8.md` e `TESTE_TRUST_REPORT_V1_8.md`.

## Novidade da v1.7.5 — Presets Tribunal

Foi adicionada a ferramenta **Presets Tribunal**. Ela permite carregar uma regra de preparação pronta, revisar cada etapa e aplicar o conjunto diretamente no **Preparar documento**. Os presets ficam no navegador e podem ser duplicados, personalizados e salvos localmente.

Presets de referência incluídos:

- PJe CNJ — referência de 3 MB, com margem configurada em 2,8 MB.
- TJRJ PJe — referência de 1,5 MB, com margem configurada em 1,4 MB.
- Protocolo genérico até 5 MB.
- Protocolo genérico até 10 MB.
- Arquivamento com OCR + PDF/A-2b.

Os presets com referência oficial exibem **fonte, data de verificação e aviso**. Regras judiciais podem variar ou mudar; o sistema de destino continua sendo a fonte final antes do protocolo.

Veja `FEATURE_PRESETS_TRIBUNAL_V1_7_5.md` e `TESTE_PRESETS_TRIBUNAL_V1_7_5.md`.


Suíte de ferramentas PDF executada majoritariamente no navegador, com foco em privacidade, compressão, organização e automação documental.

## Novidade da v1.7.4 — Comparar PDFs

Foi adicionada a ferramenta **Comparar PDFs**, voltada a contratos, versões de documentos e revisão jurídica/corporativa. Ela recebe um PDF original e um revisado, alinha páginas, identifica páginas modificadas/adicionadas/removidas, compara texto e opcionalmente faz análise visual local.

O resultado mostra as duas páginas lado a lado, contagem de palavras adicionadas/removidas, estimativa de diferença visual e permite baixar um relatório PDF das alterações.

Veja `FEATURE_COMPARAR_PDFS_V1_7_4.md` e `TESTE_COMPARAR_PDFS_V1_7_4.md`.


## Novidade da v1.7.3 — Redação permanente

Foi adicionada a ferramenta **Redação permanente**, com seleção visual por retângulos. O usuário navega pelas páginas, arrasta sobre os dados sensíveis e só então aplica a remoção definitiva.

A implementação não desenha apenas uma tarja sobre o conteúdo: cada página que recebe uma redação é rasterizada, as áreas marcadas são pintadas sobre a imagem renderizada e a página é reconstruída sem carregar o conteúdo original. Páginas sem redação são preservadas.

Antes do download, o PDF Studio reabre o resultado e verifica se as páginas redigidas não possuem camada de texto extraível. O documento também é reconstruído em um catálogo novo, sem copiar metadados/anexos documentais antigos.

Limitações intencionais de segurança: páginas redigidas deixam de ter texto selecionável, links, campos de formulário e anotações.

Veja `FEATURE_REDACAO_PERMANENTE_V1_7_3.md` e `TESTE_REDACAO_PERMANENTE_V1_7_3.md`.

## Novidade da v1.7.2 — Mesclar + Bookmarks Pro

A ferramenta **Mesclar PDF** agora suporta categorias e bookmarks hierárquicos. Cada PDF pode ser associado a uma categoria como `PETIÇÕES`, `DOCUMENTOS`, `CONTRATOS` ou uma categoria criada pelo usuário. O PDF final mantém a ordem física definida por drag-and-drop, mas o painel lateral pode agrupar a navegação em uma árvore expansível.

Exemplo:

```text
> Índice de documentos
> PETIÇÕES
    > Petição Inicial
    > Contestação
> DOCUMENTOS
    > RG
    > CPF
    > Comprovante
> CONTRATOS
    > Contrato Principal
    > Aditivo 01
```

Recursos adicionais:

- categorias editáveis;
- atribuição individual de categoria por arquivo;
- categorização automática opcional pelo nome do arquivo;
- arquivos sem categoria continuam como bookmarks de primeiro nível;
- categorias seguem a ordem da primeira aparição na lista;
- o índice clicável da v1.7.1 continua disponível e pode ser usado junto com os bookmarks Pro.

Veja `FEATURE_BOOKMARKS_PRO_V1_7_2.md` e `TESTE_BOOKMARKS_PRO_V1_7_2.md`.

## Novidade da v1.7.1 — Índice automático clicável

A ferramenta **Mesclar PDF** agora pode inserir uma ou mais páginas de índice no início do arquivo final. Cada linha mostra o nome do PDF de origem e a página física em que aquele documento começa. A linha inteira é um link interno clicável.

Exemplo:

```text
ÍNDICE DE DOCUMENTOS
Petição Inicial ........................ 2
Procuração ............................ 19
Contrato Social ....................... 22
RG .................................... 39
```

O índice respeita a ordem definida por drag-and-drop. Quando bookmarks também estão ativados, a navegação lateral inclui o próprio índice e cada documento. Veja `FEATURE_INDICE_CLICAVEL_V1_7_1.md`.

## Base da v1.7.0 — Preparar documento

A área **Legal / Business** começa com um orquestrador de documentos: o usuário seleciona um PDF uma única vez e escolhe quais etapas deseja aplicar.

Pipeline disponível:

1. Remover páginas em branco
2. Comprimir
3. OCR pesquisável
4. Remover metadados
5. Marca d’água
6. Numeração de páginas
7. Converter para PDF/A

O painel mostra progresso por etapa, identifica exatamente onde uma falha ocorreu e gera um relatório final do processamento. Veja `FEATURE_LEGAL_BUSINESS_V1_7.md`.

## Base herdada da v1.6.0 — Document Tools

Foram adicionadas sete ferramentas:

- **Marca d’água** — texto, opacidade, tamanho, rotação e posição.
- **Numeração de páginas** — número inicial, prefixo, `X de Y` e posição.
- **Remover páginas em branco** — detecção textual + visual com três sensibilidades.
- **Remover metadados** — limpa XMP e informações documentais com qpdf/fallback.
- **Proteger com senha** — AES-256 via qpdf WebAssembly.
- **Extrair imagens** — imagens raster incorporadas exportadas em PNG dentro de ZIP.
- **PDF → PDF/A** — PDF/A-1b, PDF/A-2b e PDF/A-3b via Ghostscript WebAssembly.

Veja `FEATURE_DOCUMENT_TOOLS_V1_6.md` e `TESTE_DOCUMENT_TOOLS_V1_6.md`.

## Ferramentas atuais

- Document Trust Report — SHA-256, relatório técnico e verificação posterior
- Presets Tribunal — regras de preparação salvas por tribunal/sistema
- Preparar documento — pipeline Legal / Business
- Comprimir PDF: Inteligente, Básico, Médio, Alto, Máximo e Por tamanho (X MB)
- Mesclar PDF com drag-and-drop, índice automático clicável e bookmarks Pro hierárquicos por categoria
- Redação permanente com seleção visual e reconstrução segura das páginas
- Comparar PDFs lado a lado com relatório de alterações
- Marca d’água
- Numeração de páginas
- Remover páginas em branco
- Remover metadados
- Proteger com senha
- Extrair imagens
- PDF → PDF/A
- Organizar páginas visualmente
- Editar páginas
- OCR pesquisável
- Processamento em lote
- Dividir PDF por tamanho
- PDF → JPG / PNG / TXT / Word (Beta)
- JPG/PNG → PDF
- Word → PDF (Beta)

## Privacidade

Os documentos não são enviados para uma API do PDF Studio. PDF.js, pdf-lib, qpdf/Ghostscript WebAssembly e Tesseract.js executam o processamento no navegador.

Alguns motores/modelos WebAssembly podem ser baixados pelo navegador no primeiro uso; isso é download de código/modelo, não upload do documento.

## Observações técnicas

- **Senha:** qpdf cria criptografia AES-256. A senha de abertura existe somente durante o processamento local.
- **Remoção de páginas em branco:** use o modo Conservador em documentos sensíveis para minimizar falsos positivos.
- **Extração de imagens:** exporta imagens raster decodificadas pelo PDF.js; texto e vetores não são imagens incorporadas.
- **PDF/A:** Ghostscript suporta PDF/A 1–3 em nível `b`. A v1.6 gera o arquivo e verifica se ele reabre corretamente, mas validação normativa completa deve ser feita com um validador PDF/A dedicado.
- Compressão extrema pode rasterizar páginas como último recurso.
- Mesclagens gigantes continuam sujeitas aos limites físicos de memória/armazenamento do navegador.

## Requisitos

- Node.js 22+
- Chrome ou Edge atualizados recomendados

## Rodar localmente

```powershell
npm install
npm run build
npm run dev
```

## Atualizar GitHub e Cloudflare

Depois de homologar:

```powershell
git add .
git commit -m "Adiciona Document Trust Report v1.8"
git push
npm run build
npx wrangler deploy
```

## Arquitetura

- React 19 + TypeScript + Vite
- PDF.js / pdfjs-dist
- pdf-lib
- qpdf WebAssembly
- Ghostscript WebAssembly
- Tesseract.js
- JSZip
- Cloudflare Workers Static Assets

## Licenças

Consulte `THIRD_PARTY_NOTICES.md`. O projeto continua marcado como `AGPL-3.0-or-later` por causa da composição atual com Ghostscript. Antes de vender uma edição proprietária/fechada, revise as licenças ou adquira/substitua os componentes necessários.
