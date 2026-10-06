# Security policy

## Princípios

- PDFs e DOCX não devem ser enviados para backend por padrão.
- Todo PDF aberto pela aplicação passa pelo loader endurecido de `src/lib/pdfjsSecure.ts`.
- A aplicação não instancia `PDFScriptingManager`; scripting de PDF permanece desabilitado por arquitetura.
- PDF.js roda com `isEvalSupported=false` e `enableXfa=false`.
- HTML convertido de DOCX é sanitizado com DOMPurify antes de entrar no DOM.
- A release publica uma Content Security Policy que bloqueia scripts externos, objetos embutidos e framing.
- Novas integrações de rede devem ser revisadas antes de produção.
- Nenhum segredo deve ser commitado no repositório.
- Dependências de produção e desenvolvimento são auditadas separadamente no CI.
- Mudanças em motores PDF devem passar pela suíte de regressão.

## Gate de release

Antes de publicar:

```powershell
npm run check
npm run test
npm run test:pdf
npm run build
npm run security:prod
npm run security:all
```

Vulnerabilidades `high` ou `critical` bloqueiam a release até correção ou análise formal. Não use `npm audit fix --force` sem validar as mudanças e os testes de regressão.

## Relato de vulnerabilidade

Durante a fase pré-lançamento, vulnerabilidades devem ser tratadas diretamente pelo mantenedor do produto e não publicadas em issues públicas contendo dados sensíveis ou arquivos de clientes.
