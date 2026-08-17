# Tarefa atual

## Objetivo

Prosseguir a Wave 1 com runtime de agente e contexto seguro após a entrega do provider local Ollama.

## Estado

O checkpoint wave-09 entregou manifestos imutáveis de efeitos e aprovação vinculada ao alvo, operação, risco e hash de payload. Escrita, terminal e Git mutável seguem indisponíveis para o executor até uma capacidade tipada e aprovada ser implementada.

## Critérios de aceite da próxima unidade

1. `workspace.write` só pode materializar um efeito quando o manifesto e a aprovação correspondente estiverem válidos.
2. O conteúdo é conferido contra o hash do manifesto e o alvo fica limitado ao workspace autorizado.
3. Todo efeito real passa por PolicyEngine e AuditLog, sem simulação de filesystem, terminal ou Git.
