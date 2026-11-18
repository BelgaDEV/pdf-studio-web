# Aviso de código-fonte e licenciamento

A partir das versões posteriores à 2.1.2, o PDF Studio **não utiliza mais o Ghostscript** (AGPL). A compressão de imagens e a conversão PDF/A foram reimplementadas com pdf-lib (MIT) e APIs nativas do navegador.

Todas as dependências de produção atuais usam licenças permissivas (MIT, Apache-2.0, BSD), que permitem distribuição comercial e código fechado, desde que os avisos de terceiros (`THIRD_PARTY_NOTICES.md`) sejam mantidos.

Observação: versões anteriores (até 2.1.2) incluíam Ghostscript e continuam sujeitas à AGPL-3.0 para quem as recebeu. A escolha da licença do código próprio do PDF Studio cabe ao autor; o campo `license` do `package.json` deve refletir essa decisão.

Este aviso não substitui análise jurídica.
