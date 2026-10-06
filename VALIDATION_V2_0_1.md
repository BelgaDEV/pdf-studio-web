# Validação v2.0.1

## Alterações desta versão

- Home redesenhada para uma experiência **tool-first**, com as ferramentas antes das seções institucionais.
- Menu superior com atalhos diretos para Juntar, Dividir e Comprimir PDF.
- Menu Converter PDF com acesso rápido aos principais conversores.
- Link direto para Todas as ferramentas, Pro Legal e Ajuda.
- Busca instantânea por título, descrição ou selo da ferramenta.
- Filtros visuais: Todas, Mais usadas, Organizar, Otimizar, Converter, Editar, Segurança e Jurídico / Pro.
- Grid responsivo com as 25 ferramentas existentes, sem esconder funcionalidades.
- Cards com destaque para POPULAR, LEGAL, TRUST e BETA quando aplicável.
- Mantidas e reposicionadas abaixo das ferramentas as seções Legal Redline, Privacidade e Planos.
- Textos de planos revisados para linguagem comercial voltada ao cliente.
- Faixa de confiança reforçando processamento local e ausência de upload do conteúdo.
- Navegação mobile atualizada com atalhos para as ferramentas principais.
- Compatibilidade de engine ampliada para Node.js `>=22 <25`, cobrindo Node 22 e Node 24.
- Versão centralizada atualizada para 2.0.1.

## Verificações executadas no ambiente de geração

- 39 arquivos TS/TSX passaram pela validação sintática via TypeScript `transpileModule`.
- Contagem de chaves do CSS validada sem desequilíbrio.
- O ambiente de geração não conseguiu resolver o registry do npm dentro do limite disponível; portanto o build Vite completo deve ser executado no computador de desenvolvimento após `npm install`.

## Validação recomendada no Windows

```powershell
npm install
npm run build
npm test
npm run dev
```

Depois abra o endereço informado pelo Vite e valide a Home em desktop e mobile.
