# PDF Studio v1.6.0 — Document Tools

A v1.6.0 adiciona sete ferramentas documentais ao projeto, mantendo o processamento local no navegador.

## 1. Marca d’água

- Texto personalizado.
- Opacidade ajustável.
- Tamanho de fonte.
- Rotação.
- Posição no centro, topo ou rodapé.
- Aplicação em todas as páginas com `pdf-lib`.

## 2. Numeração de páginas

- Número inicial configurável.
- Prefixo personalizado, como `Página `.
- Opção `X de Y`.
- Rodapé central, rodapé direito ou topo central.
- Tamanho de fonte configurável.

## 3. Remover páginas em branco

O detector usa duas verificações:

1. conteúdo textual extraído pelo PDF.js;
2. análise visual em baixa resolução para páginas sem texto.

Há três níveis de sensibilidade: Conservadora, Normal e Agressiva.

## 4. Remover metadados

O app tenta primeiro qpdf WebAssembly com remoção de XMP e do dicionário Info. Se esse motor não estiver disponível, usa um fallback `pdf-lib` para limpar os principais dicionários de metadados.

## 5. Proteger com senha

- qpdf WebAssembly.
- Criptografia AES-256.
- Senha de abertura definida pelo usuário.
- Owner password aleatória gerada localmente para evitar configuração insegura.
- A senha não é enviada nem armazenada pelo PDF Studio.

## 6. Extrair imagens

- Analisa os operadores de imagem do PDF.js.
- Extrai imagens raster incorporadas.
- Exporta em PNG.
- Entrega todas as imagens em ZIP.
- Permite ignorar imagens muito pequenas para evitar ícones e elementos decorativos.

Limitação: texto e arte vetorial não são tratados como imagens incorporadas.

## 7. PDF → PDF/A

Conversão com Ghostscript WebAssembly para:

- PDF/A-1b
- PDF/A-2b
- PDF/A-3b

O app usa um OutputIntent RGB com o perfil `default_rgb.icc` compilado no Ghostscript. A saída é reaberta com PDF.js para confirmar que o documento continua estruturalmente legível.

Importante: a checagem interna não substitui um validador normativo PDF/A. Para arquivamento regulatório, valide o arquivo final com veraPDF ou ferramenta equivalente.
