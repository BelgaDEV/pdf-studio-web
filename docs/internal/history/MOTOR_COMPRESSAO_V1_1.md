# PDF Studio Web v1.1 — novo motor de compressão

A v1.0 usava principalmente `pdf-lib` + PDF.js/Canvas. Essa abordagem funciona para manipulação de páginas, mas não possui um verdadeiro `pdfwrite` capaz de recomprimir seletivamente imagens, fontes e streams internos como o aplicativo desktop.

A v1.1 troca o compressor por uma pipeline WebAssembly:

- **Básico:** qpdf WebAssembly — recompressão Flate nível 9, object streams e remoção de recursos não referenciados, sem rasterização.
- **Médio:** Ghostscript WebAssembly 170 DPI / JPEG 80 → qpdf WebAssembly.
- **Alto:** Ghostscript WebAssembly 120 DPI / JPEG 62 → qpdf WebAssembly.
- **Máximo:** Ghostscript 96 DPI / JPEG 48 → qpdf; se a economia for inferior a ~6%, tenta 72 DPI / JPEG 35. Se ainda assim o PDF estiver praticamente sem redução, usa rasterização adaptativa como último recurso.
- **Inteligente:** analisa tamanho por página + amostra de texto e escolhe um perfil. PDFs longos/textuais de ~80–250 KB/página agora vão para **Médio**, não para Básico automaticamente.

## Por que isso deve melhorar o caso de 54,1 MB / 477 páginas?

A versão anterior rasterizava cada página e comparava o resultado. Um PDF textual já compacto pode ficar MAIOR ao ser convertido para JPEG, então a proteção devolvia o original.

O novo Ghostscript `pdfwrite` preserva texto/vetores enquanto reduz imagens e estruturas quando possível. Isso é muito mais próximo do motor desktop.

## Instalação

Na pasta nova:

```powershell
npm install
npm run build
npm run dev
```

Ou execute:

`ATUALIZAR_V1_1.bat`

Depois de testar:

```powershell
git add .
git commit -m "Upgrade compressor para Ghostscript e qpdf WASM"
git push
npx wrangler deploy
```

## Primeira compressão

O navegador precisa baixar/instanciar os binários WebAssembly do Ghostscript/qpdf. A primeira compressão da sessão pode levar alguns segundos extras. Depois os assets ficam em cache pelo navegador/Cloudflare.

## Privacidade

O PDF continua sendo processado localmente no navegador. Os módulos WASM são baixados como parte do site; o documento não é enviado ao Cloudflare nem a uma API.

## Licença importante

Ghostscript é distribuído sob AGPL-3.0-or-later (ou licença comercial). Esta edição Web usa Ghostscript WASM, portanto o projeto público precisa respeitar a AGPL. Para portfólio open-source com o código disponível no GitHub isso é compatível com o caminho escolhido. Antes de transformar o serviço em produto proprietário/comercial fechado, revise a licença ou adquira licença comercial da Artifex.
