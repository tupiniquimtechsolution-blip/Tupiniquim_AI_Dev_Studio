# Tarefa atual

## Objetivo

Prosseguir a Wave 1 com runtime de agente e contexto seguro após a entrega do provider local Ollama.

## Estado

O checkpoint wave-10 entregou `workspace.write` real e atômico, restrita a manifesto aprovado e hash de conteúdo correspondente. Terminal e Git mutável seguem indisponíveis para o executor.

## Critérios de aceite da próxima unidade

1. O runtime propõe manifestos de escrita sem persistir payload bruto e sem permitir que o conteúdo do workspace instrua a política.
2. A UI mostra o manifesto proposto para revisão humana antes de habilitar a aprovação correspondente.
3. Todo efeito real continua passando por PolicyEngine e AuditLog, sem simulação de terminal ou Git.
