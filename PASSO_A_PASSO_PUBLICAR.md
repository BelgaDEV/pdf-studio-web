# Publicar o PDF Studio Web grátis no Cloudflare Pages

## 1. Preparar no seu computador

1. Instale **Node.js 22 LTS**.
2. Extraia completamente o ZIP do projeto.
3. Abra a pasta.
4. Dê duplo clique em `INSTALAR_E_TESTAR.bat`.
5. Aguarde `npm install` e `npm run build`.
6. O navegador abrirá em `http://localhost:5173` para teste local.
7. Teste principalmente:
   - Comprimir PDF
   - Mesclar
   - Dividir por MB
   - PDF para JPG/PNG
   - Imagens para PDF
   - PDF para TXT

## 2. Gerar a versão para internet

Feche o servidor local e execute:

`BUILD_PRODUCAO.bat`

Ao terminar deverá existir:

`dist/`

Essa pasta é o site final. Não envie `src`, `node_modules` ou arquivos do projeto para hospedagem quando usar Direct Upload; basta `dist`.

---

# OPÇÃO MAIS RÁPIDA — sem GitHub

1. Crie uma conta gratuita na Cloudflare.
2. Entre no Dashboard.
3. Abra **Workers & Pages**.
4. Selecione **Create application**.
5. Procure **Pages** / **Drag and drop your files**.
6. Informe um nome, por exemplo `pdf-studio-carlos`.
7. Arraste a pasta `dist` para a área de upload.
8. Clique em **Deploy site**.
9. Aguarde alguns segundos.
10. A Cloudflare fornecerá um endereço semelhante a:

`https://pdf-studio-carlos.pages.dev`

Pronto: esse é o link público.

### Atualizar depois

Faça as alterações no projeto, rode novamente:

`BUILD_PRODUCAO.bat`

Depois, no seu projeto do Cloudflare Pages, escolha **Create a new deployment** e envie a nova pasta `dist`.

---

# OPÇÃO RECOMENDADA — GitHub + deploy automático

## Criar o GitHub

Crie um repositório chamado:

`pdf-studio-web`

Abra PowerShell dentro da pasta do projeto:

```powershell
git init
git add .
git commit -m "PDF Studio Web v1"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/pdf-studio-web.git
git push -u origin main
```

## Conectar Cloudflare

1. Cloudflare Dashboard.
2. **Workers & Pages**.
3. **Create application**.
4. **Pages**.
5. **Import an existing Git repository**.
6. Autorize o GitHub.
7. Selecione `pdf-studio-web`.
8. Configure:

| Campo | Valor |
|---|---|
| Production branch | `main` |
| Framework | `Vite` ou `None` |
| Build command | `npm run build` |
| Build output directory | `dist` |

9. Clique em **Save and Deploy**.

A partir daí, todo `git push` gera uma nova versão automaticamente.

---

# Importante sobre privacidade

Este projeto não possui endpoint para upload de PDFs. O arquivo é lido pelo JavaScript no navegador, processado localmente e o resultado é criado como um Blob para download.

Para confirmar isso no navegador:

1. Abra `F12`.
2. Vá em **Network**.
3. Selecione um PDF e comprima.
4. Você verá carregamentos dos arquivos JavaScript do site, mas não um POST enviando seu PDF a uma API.

---

# Limitações da versão sem backend

- Médio, Alto e Máximo podem rasterizar as páginas para obter redução forte; a aparência é preservada, mas texto selecionável, links e formulários podem ser perdidos.
- PDF → Word é Beta e prioriza texto, não reconstrução perfeita de layout.
- Word → PDF é Beta e reconstrói o DOCX no navegador; documentos muito complexos podem variar visualmente.
- PDFs protegidos por senha podem não funcionar.
- Em celular, PDFs muito grandes podem exceder a memória disponível.

