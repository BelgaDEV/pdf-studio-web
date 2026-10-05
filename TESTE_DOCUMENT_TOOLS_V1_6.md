# Checklist de testes — Document Tools v1.6.0

## Marca d’água

1. Use um PDF de 5+ páginas.
2. Texto: `CONFIDENCIAL`.
3. Opacidade: 18%.
4. Rotação: -35°.
5. Confirme a marca em todas as páginas e que o PDF abre normalmente.

## Numeração

1. Comece em 1.
2. Ative `Mostrar total de páginas`.
3. Use `Página ` como prefixo.
4. Confirme `Página 1 de X`, `Página 2 de X` etc.

## Remover páginas em branco

1. Crie um PDF com páginas vazias entre páginas com conteúdo.
2. Teste primeiro em `Normal`.
3. Confirme que apenas páginas vazias foram removidas.
4. Teste um scan vazio com ruído usando `Agressiva`.

## Remover metadados

1. Use um PDF que tenha Autor/Título.
2. Execute a limpeza.
3. Abra Propriedades do documento em um leitor de PDF e confira os campos.

## Proteger com senha

1. Defina uma senha com pelo menos 4 caracteres.
2. Baixe o resultado.
3. Feche o navegador/leitor.
4. Abra o PDF novamente e confirme que a senha é exigida.
5. Teste senha errada e senha correta.

## Extrair imagens

1. Use um PDF com fotos incorporadas.
2. Deixe limite mínimo em 32 px.
3. Confirme o ZIP e os PNGs.
4. Confira se dimensões e aparência das imagens estão corretas.

## PDF/A

1. Teste PDF/A-2b primeiro.
2. Abra o PDF final.
3. Confirme páginas, fontes e aparência.
4. Para validação de conformidade, teste o resultado em veraPDF.
