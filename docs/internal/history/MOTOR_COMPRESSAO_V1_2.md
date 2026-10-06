# Motor de compressão v1.2

Esta versão corrige dois comportamentos observados em produção:

1. Ghostscript/qpdf WASM podiam falhar silenciosamente após o bundling Vite e o app caía no motor de compatibilidade.
2. O motor de compatibilidade rasterizava em DPI/qualidade fixos e, se o resultado fosse maior, devolvia o original sem redução.

## Alterações

- Vite agora trata `.wasm` explicitamente como asset e exclui os wrappers WASM do `optimizeDeps`.
- qpdf WASM atualizado para 0.1.1.
- Headers explícitos para `.wasm`.
- A recomendação Inteligente não classifica apostilas grandes como Básico apenas por conterem muito texto.
- Se o Ghostscript WASM falhar, Médio/Alto/Máximo usam um fallback adaptativo com orçamento de bytes por página.
- O fallback reduz qualidade JPEG e resolução gradualmente até aproximar a meta do perfil.
- O app nunca apresenta um arquivo maior como resultado útil; se não houver redução, preserva o original.

## Metas do fallback

- Médio: aproximadamente <= 70% do tamanho original, priorizando leitura.
- Alto: aproximadamente <= 52%.
- Máximo: aproximadamente <= 34%.

As metas não são garantias matemáticas: conteúdo, número de páginas e overhead do PDF influenciam o resultado. O fallback rasteriza as páginas e portanto pode remover texto selecionável, links e formulários. Ele só é usado quando o motor avançado WebAssembly falha.
