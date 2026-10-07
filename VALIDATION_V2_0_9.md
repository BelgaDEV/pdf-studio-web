# PDF Studio v2.0.9 — Validation

Execute na máquina de desenvolvimento:

```powershell
npm install
npm run check
npm run test
npm run test:pdf
npm run security
npm run build
npm run performance:bundle
npm run test:e2e
```

## Critérios esperados

- TypeScript sem erros;
- testes unitários, segurança e Public Polish aprovados;
- regressão PDF aprovada;
- 0 vulnerabilidades High/Critical pelo gate atual;
- build Vite concluído;
- motores pesados fora do grafo inicial;
- `/privacy`, `/terms`, `/licenses`, `/contact` acessíveis;
- URL inválida e `/tool/<id-inválido>` exibem 404 real;
- footer mostra a versão 2.0.9.
