# Validação v2.0.4

## Correções

- Navegação para qualquer rota `/tool/*` reinicia a rolagem no topo da ferramenta.
- A restauração automática de scroll do navegador foi desativada durante a SPA para evitar herdar a posição da página anterior.
- Links com hash continuam rolando para a seção correta da landing page.
- Descrições do mega menu foram ampliadas para 10.2 px e agora podem ocupar até duas linhas, evitando texto minúsculo/truncado.
- Títulos das ferramentas do mega menu foram ampliados para 12 px.

## Regressão esperada

- Home -> ferramenta: abre no topo.
- Sidebar -> outra ferramenta: abre no topo.
- Mega menu -> ferramenta: abre no topo.
- Links `/#privacidade`, `/#planos` e `/#ferramentas`: continuam respeitando a âncora.
