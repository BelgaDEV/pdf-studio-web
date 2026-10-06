# PDF Studio Web v1.3 — Comprimir para X MB

Nova opção **Por tamanho** no compressor.

## Como funciona

O usuário informa um limite, por exemplo **10 MB**. O motor tenta chegar ao limite nesta ordem:

1. qpdf WebAssembly — otimização estrutural, sem rasterização.
2. Ghostscript WebAssembly — perfis progressivamente mais fortes, tentando preservar texto/vetores.
3. qpdf final — tenta retirar mais alguns pontos percentuais.
4. Se ainda estiver acima do alvo, entra o ajuste adaptativo por página, calculando um orçamento de bytes para cada página.

O último estágio pode rasterizar páginas. A interface avisa isso explicitamente.

## Segurança

- O alvo deve ser menor que o PDF original.
- Metas tecnicamente muito baixas são bloqueadas para evitar documentos ilegíveis.
- O resultado é validado como PDF antes do download.
- Se a meta não puder ser alcançada, o app entrega o menor resultado válido e informa **Melhor resultado**, em vez de alegar sucesso incorretamente.
- Nenhum arquivo é enviado para servidor.

## Exemplo

Arquivo original: 54,1 MB

Meta: 10 MB

O app pode tentar:

- qpdf: 52 MB
- Ghostscript Alto: 28 MB
- Ghostscript Máximo: 17 MB
- ajuste adaptativo: 9,7 MB

Resultado: **Meta atingida — 9,7 MB**.

Os valores acima são apenas exemplo; PDFs diferentes produzem resultados diferentes.
