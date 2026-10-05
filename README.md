# PDF Studio Web Client v1.4.1

Suíte de ferramentas PDF executada no navegador, com foco em privacidade, compressão e organização de documentos.

## Novidades da v1.4.1

- **Mesclagem massiva corrigida**: qpdf WebAssembly para centenas/milhares de PDFs, modo por blocos para cargas grandes, progresso imediato e erros persistentes.
- **Organizador visual de páginas**: miniaturas, drag-and-drop, setas para touch/mobile, remoção e extração de páginas selecionadas.
- **Editor básico de páginas**: girar 90°, duplicar, excluir e reorganizar páginas.
- **OCR pesquisável**: Tesseract.js em WebAssembly para adicionar camada de texto pesquisável a PDFs escaneados.
- **Processamento em lote**: comprime vários PDFs sequencialmente e gera um ZIP com relatório.

## Ferramentas

- Comprimir PDF: Inteligente, Básico, Médio, Alto, Máximo e **Por tamanho (X MB)**
- Mesclar PDFs com ordenação drag-and-drop
- Organizar páginas visualmente
- Editar páginas
- OCR pesquisável para documentos escaneados
- Processamento em lote
- Dividir PDF por tamanho máximo em MB
- PDF → JPG / PNG / TXT / Word (Beta)
- JPG/PNG → PDF
- Word → PDF (Beta)

## Privacidade

Os documentos não são enviados para uma API de processamento. PDF.js, pdf-lib, qpdf/Ghostscript WebAssembly e Tesseract.js executam o trabalho no navegador do usuário.

**OCR:** no primeiro uso, o Tesseract.js pode baixar do CDN o motor e os modelos de idioma. Isso é download de código/modelo para o navegador; o documento do usuário continua sendo processado localmente.

## Limitações importantes

- Compressões muito agressivas podem rasterizar páginas como último recurso, removendo texto selecionável, links e formulários.
- OCR depende da resolução e qualidade do escaneamento. Português, inglês e português+inglês estão disponíveis na interface.
- PDFs muito grandes podem consumir bastante RAM, especialmente ao gerar centenas de miniaturas ou executar OCR.
- PDF → Word e Word → PDF permanecem Beta para layouts complexos.

## Requisitos

- Node.js 22+
- Chrome, Edge ou Firefox atualizados

## Rodar localmente

```powershell
npm install
npm run build
npm run dev
```

O Vite exibirá a URL local, normalmente `http://localhost:5173`.

## Publicar no projeto atual da Cloudflare

O projeto oficial está configurado para **Cloudflare Workers + Static Assets** via `wrangler.jsonc`.

```powershell
npm run build
npx wrangler deploy
```

Para manter o GitHub sincronizado:

```powershell
git add .
git commit -m "Adiciona organizador OCR lote e editor de paginas"
git push
npx wrangler deploy
```

## Arquitetura

- React 19 + TypeScript + Vite
- PDF.js / pdfjs-dist
- pdf-lib
- Ghostscript WebAssembly
- qpdf WebAssembly
- Tesseract.js WebAssembly
- JSZip
- Mammoth / docx / jsPDF / html2canvas
- Cloudflare Workers Static Assets

## Licenças

Consulte `THIRD_PARTY_NOTICES.md`. O projeto atual continua marcado como `AGPL-3.0-or-later` por causa da composição/licenciamento usada no motor Ghostscript. Antes de vender uma versão proprietária/fechada, faça revisão jurídica das licenças ou substitua/licencie comercialmente os componentes necessários.

## v1.4.1 — Mesclagem massiva

A ferramenta Mesclar PDF ativa automaticamente um motor qpdf WebAssembly para 100+ arquivos ou cargas grandes. Para volumes muito grandes, usa mesclagem por blocos e consolidação progressiva, mantendo progresso visível e erros persistentes na interface. Veja `CORRECAO_MESCLAGEM_MASSIVA.md`.
