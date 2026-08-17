# Tarefa atual

## Objetivo

Prosseguir a Wave 1 com runtime de agente e contexto seguro após a entrega do provider local Ollama.

## Estado

O checkpoint wave-05 entregou o adapter Ollama local com validate e E2E, sem instalação automática. A execução de planos ainda não aciona capacidades reais.

## Critérios de aceite da próxima unidade

1. Execução só pode materializar um passo quando o plano e a aprovação correspondente estiverem válidos.
2. Todo efeito real passa por PolicyEngine e AuditLog, sem simulação de filesystem, terminal ou Git.
3. Contexto persistido contém referências, hashes e conteúdo redigido, respeitando limites explícitos.
