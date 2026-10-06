# v1.7.5 — Presets Tribunal

A v1.7.5 adiciona uma biblioteca de regras de preparação reutilizáveis para fluxos jurídicos e corporativos.

## O que faz

- Mostra presets de referência com tribunal/sistema, fonte e data de verificação.
- Permite alterar limite de tamanho, OCR, remoção de páginas em branco, metadados, numeração e PDF/A.
- Permite duplicar um preset de referência e salvar uma cópia editável.
- Permite criar presets personalizados e persistir no `localStorage` do navegador.
- Envia o preset selecionado para `Preparar documento`, preenchendo automaticamente todas as opções.

## Presets incluídos

- PJe CNJ — referência 3 MB; alvo de 2,8 MB para margem operacional.
- TJRJ PJe — referência 1,5 MB; alvo de 1,4 MB para margem operacional.
- Protocolo leve — até 5 MB.
- Protocolo profissional — até 10 MB.
- Arquivamento — OCR + PDF/A-2b.

## Segurança jurídica do recurso

Um preset nunca é apresentado como garantia de aceitação. Regras podem mudar por versão, tribunal, classe processual e tipo de documento. Presets oficiais exibem fonte e data de verificação e a interface orienta o usuário a confirmar as regras no sistema de destino.

## Privacidade

Os presets personalizados ficam apenas no `localStorage` do navegador. Nenhum PDF ou regra personalizada é enviada ao PDF Studio.
