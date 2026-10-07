# PDF Studio v2.0.9 — Public Polish

Esta versão não adiciona novas ferramentas. Ela prepara a superfície pública do produto para usuários reais.

## Alterações

- versão centralizada em `APP_VERSION = 2.0.9`;
- FAQ e Roadmap deixam de exibir versões antigas como se fossem atuais;
- Roadmap condensado e atualizado até a v2.0.9;
- rota 404 real para URLs desconhecidas e IDs de ferramentas inválidos;
- `ErrorBoundary` global com recuperação por recarregamento ou retorno à Home;
- páginas públicas `/privacy`, `/terms`, `/licenses` e `/contact`;
- rodapé com links permanentes para informações públicas;
- cartões de planos deixam explícito que a camada comercial ainda está em preparação;
- metadados de título e descrição passam a variar por rota;
- assets com hash em `/assets/*` recebem cache de 1 ano + `immutable`;
- `index.html` usa `no-cache` para facilitar atualização da aplicação;
- testes automáticos para as garantias acima.

## Princípio

A v2.0.9 evita prometer cobrança, suporte ou conformidade que ainda não estão operacionalizados. A intenção é que a interface pública diga exatamente o que o produto faz hoje.
