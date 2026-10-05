# v1.8.0 — Document Trust Report

A v1.8 adiciona uma camada de integridade e rastreabilidade ao PDF Studio.

## O que é gerado

Ao concluir **Preparar documento**, o usuário pode manter habilitada a opção **Gerar Document Trust Report**. O PDF Studio calcula localmente:

- SHA-256 do PDF original;
- SHA-256 do PDF final;
- SHA-256 interno do próprio payload do relatório JSON;
- tamanho em bytes e formato amigável;
- quantidade de páginas antes e depois;
- etapas efetivamente executadas;
- diferenças de tamanho por etapa;
- páginas em branco removidas;
- informações de OCR quando aplicável;
- validação da meta de tamanho quando o modo `Para X MB` é usado;
- observações de PDF/A e remoção de metadados;
- preset aplicado, quando o fluxo veio de Presets Tribunal.

O relatório recebe um identificador no formato:

`PS-AAAAMMDD-XXXXXXXXXXXX`

## Dois formatos

### Relatório PDF

Documento visual pensado para auditoria humana, contendo identificação do processamento, arquivos, hashes completos, etapas e validações.

### JSON verificável

Arquivo técnico com schema `pdf-studio-trust/v1`. Esse é o formato usado pela ferramenta **Document Trust Report** para revalidar o PDF posteriormente.

## Verificação posterior

Na rota `/tool/trust-report` o usuário seleciona:

1. o PDF final;
2. o Trust Report JSON.

O PDF Studio recalcula localmente:

- SHA-256 do PDF;
- tamanho exato em bytes;
- quantidade de páginas;
- SHA-256 interno do relatório JSON.

Se tudo coincidir, a interface informa que o documento corresponde ao Trust Report.

## Document Fingerprint

A mesma página permite selecionar apenas um PDF e gerar sua impressão técnica local:

- SHA-256;
- tamanho;
- páginas.

Isso não exige um Trust Report pré-existente.

## Limites de confiança

O Document Trust Report v1.8 é um **registro técnico local**. Ele não é:

- assinatura digital ICP-Brasil;
- carimbo do tempo emitido por TSA;
- certificado de uma autoridade externa;
- laudo pericial;
- prova independente de autoria;
- validador formal de conformidade PDF/A.

O hash interno do JSON detecta alterações acidentais ou inconsistências, mas uma pessoa que controle o JSON pode criar um novo JSON e recalcular seus hashes. Uma edição futura poderá adicionar assinatura criptográfica do relatório.

## Privacidade

O conteúdo textual dos documentos não é inserido no Trust Report. O relatório guarda somente dados técnicos, nomes dos arquivos, hashes, tamanhos, páginas, etapas e resultados técnicos do fluxo.
