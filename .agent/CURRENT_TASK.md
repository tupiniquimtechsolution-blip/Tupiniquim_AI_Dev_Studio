# Tarefa atual

## Objetivo

Prosseguir a Wave 1 com runtime de agente e contexto seguro após a entrega do provider local Ollama.

## Estado

O checkpoint wave-13 entrega o ciclo de consumo de proposta de `workspace.write`: o renderer entrega somente o id após a aprovação e o payload permanece no processo principal. Terminal e Git mutável seguem indisponíveis para o executor.

## Critérios de aceite da próxima unidade

1. A origem da proposta é integrada ao protocolo de ferramenta do agente, sem encaminhar payload pelo renderer ou persistir conteúdo bruto.
2. A UI identifica thread/turn de origem e mostra somente o manifesto proposto para revisão humana antes da aprovação.
3. Todo efeito real continua passando por PolicyEngine e AuditLog, sem simulação de terminal ou Git.
