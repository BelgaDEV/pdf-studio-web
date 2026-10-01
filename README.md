# PDF Studio Web Client v1.2.0

**Atualização de compressão:** esta versão corrige o fallback que podia devolver o PDF original sem reduzir. O Vite também foi ajustado para empacotar os motores WebAssembly com mais confiabilidade. Se o Ghostscript WASM não inicializar, Médio/Alto/Máximo passam a usar compressão visual adaptativa com meta de tamanho.

Veja `MOTOR_COMPRESSAO_V1_2.md`.


Suíte de ferramentas PDF executada **inteiramente no navegador**. Não existe backend, banco, bucket ou upload dos documentos para um servidor.

## O que funciona

- Compressão de PDF: Inteligente, Básico, Médio, Alto e Máximo
- Barra de progresso real por página nas operações que percorrem o PDF
- Mesclar vários PDFs
- Dividir PDF por tamanho máximo em MB
- PDF → JPG
- PDF → PNG
- JPG/PNG → PDF
- PDF → TXT
- PDF → Word (Beta, prioriza texto)
- Word (.docx) → PDF (Beta, usa reconstrução no navegador)
- Preview da primeira página
- Interface responsiva desktop/tablet/mobile
- Sem upload e sem backend

## Limitações técnicas importantes

### Compressão

- **Básico** regrava/otimiza a estrutura e preserva texto/vetores.
- **Médio / Alto / Máximo** priorizam tamanho e aparência visual. Eles rasterizam páginas, portanto texto selecionável, links, formulários e outros recursos interativos podem ser perdidos.
- Se a recompressão gerar um arquivo maior, o app devolve o original em vez de aumentar o tamanho.

### PDF → Word

É uma conversão Beta orientada a texto. PDFs com tabelas complexas, colunas, elementos posicionados ou documentos escaneados não terão fidelidade perfeita. OCR não está incluído nesta v1.

### Word → PDF

É uma conversão Beta baseada em DOCX → HTML → renderização → PDF. Documentos simples funcionam melhor; documentos Word muito complexos podem apresentar diferenças de layout.

## Requisitos locais

- Node.js 22+
- Chrome, Edge ou Firefox atualizados

## Rodar localmente no Windows

Extraia a pasta e dê duplo clique em:

`INSTALAR_E_TESTAR.bat`

Ou manualmente:

```powershell
npm install
npm run dev
```

Abra:

`http://localhost:5173`

## Validar build de produção

```powershell
npm run build
```

O resultado ficará em:

`dist/`

## Publicar grátis no Cloudflare Pages — opção recomendada

### Caminho A — GitHub + deploy automático

1. Crie uma conta gratuita em Cloudflare.
2. Crie um repositório público ou privado no GitHub, por exemplo `pdf-studio-web`.
3. Abra PowerShell nesta pasta e execute:

```powershell
git init
git add .
git commit -m "PDF Studio Web v1"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/pdf-studio-web.git
git push -u origin main
```

4. Entre no Cloudflare Dashboard.
5. Vá em **Workers & Pages**.
6. Clique em **Create application**.
7. Escolha **Pages**.
8. Escolha **Import an existing Git repository**.
9. Autorize o GitHub e selecione `pdf-studio-web`.
10. Configure:

- Production branch: `main`
- Framework preset: `Vite` se aparecer; caso contrário `None`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 22 (o projeto também inclui `.node-version`)

11. Clique em **Save and Deploy**.
12. Ao final você receberá uma URL semelhante a:

`https://pdf-studio-web.pages.dev`

Cada `git push` futuro fará novo deploy automaticamente.

### Caminho B — Direct Upload

Se não quiser GitHub:

1. Rode `BUILD_PRODUCAO.bat`.
2. Confirme que a pasta `dist` foi criada.
3. No Cloudflare Dashboard vá em **Workers & Pages → Create application → Get started → Drag and drop your files**.
4. Dê um nome ao projeto.
5. Arraste a pasta `dist` ou um ZIP contendo o conteúdo de `dist`.
6. Clique em **Deploy site**.

Atenção: projetos criados como Direct Upload não podem ser convertidos depois para Git integration; seria necessário criar outro projeto.

## Segurança/privacidade

O projeto não contém chamadas de API para upload dos documentos. Os arquivos ficam na memória/armazenamento temporário do navegador durante o processamento e o resultado é baixado diretamente pelo usuário.

## Bibliotecas principais

- React
- Vite
- PDF.js / pdfjs-dist
- pdf-lib
- JSZip
- docx
- Mammoth
- jsPDF
- html2canvas
- DOMPurify

## Sugestões para v2

- OCR client-side via WebAssembly
- editor visual de páginas antes de mesclar/dividir
- ordenar arquivos por drag-and-drop
- PWA instalável
- processamento em Web Worker dedicado para compressão pesada
- benchmark de qualidade/tamanho
- recuperação de texto pesquisável após rasterização via OCR


## Motor de compressão v1.1

A compressão agora usa **Ghostscript WebAssembly + qpdf WebAssembly** diretamente no navegador. Veja `MOTOR_COMPRESSAO_V1_1.md`.
