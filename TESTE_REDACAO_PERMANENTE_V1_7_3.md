# Homologação — Redação permanente v1.7.3

## Teste mínimo

Crie/use um PDF com texto pesquisável contendo uma frase fácil de localizar, por exemplo:

`CPF: 123.456.789-00`

1. Abra **Redação permanente**.
2. Marque somente a linha do CPF.
3. Gere o PDF redigido.
4. Abra o resultado no Adobe Reader/Edge.
5. A página marcada deve conter a tarja preta.
6. Tente selecionar/copiar o texto daquela página: a página redigida deve estar achatada como imagem.
7. Use `Ctrl+F` para procurar `123.456.789-00`: o valor não pode ser encontrado na página redigida.
8. Abra uma página que não recebeu redação: o texto dela deve continuar selecionável.

## Navegação

- marque áreas em pelo menos 3 páginas diferentes;
- navegue entre páginas e confirme que as marcações permanecem;
- use Desfazer e Limpar página;
- teste zoom de 70% até 180%;
- confirme que a posição das tarjas no arquivo final corresponde à prévia.

## Qualidade

Teste 150, 200 e 300 DPI. A opção recomendada é 200 DPI.

## Critério de aprovação

O download só deve ser liberado depois da mensagem `Redação permanente verificada com sucesso.`. Se a página redigida ainda possuir texto extraível, a geração deve ser bloqueada.
