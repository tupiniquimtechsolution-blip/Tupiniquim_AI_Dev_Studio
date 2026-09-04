# Tarefa atual

## Objetivo

Fechar Wave 14: consolidar protocolo de tool calling provider-neutral, garantir proveniência causal completa, adicionar EXPIRED como status explícito, e refazer browser QA para cenários de falha/expiração.

## Estado

A branch `freebuff/wave-14-proposal-tool-provenance` implementa:

1. `NormalizedToolCallEnvelope` — contrato sem acoplamento ao Ollama
2. `workspaceWriteArgsSchema` — validação compartilhada de business arguments
3. `WorkspaceBaselineLookup` — injeção de dependência para inspeção de baseline
4. `proposeFromEnvelope()` — caminho canônico provider-neutral
5. `validateProposalState()` — validação causal unificada para lookupStatus e consume
6. `EXPIRED` status — IPC, UI tombstone, remoção de payload
7. E2E de expiração — escrito, BLOCKED neste ambiente
8. 6 novos testes unit/integration — CREATE exists, REPLACE missing, EXPIRED substitution, workspace drift, thread drift, purge

CI remoto #14 está VERDE.

## Critérios de aceite desta unidade

1. ✅ O runtime não depende do formato bruto do Ollama para validar propostas
2. ✅ CREATE rejeita alvo existente; REPLACE rejeita alvo inexistente
3. ✅ lookupStatus usa a mesma validação causal de consume
4. ✅ Proposta substituída recebe EXPIRED via lookupProposalStatus IPC
5. ✅ UI mostra tombstone EXPIRED com proveniência pública sem conteúdo
6. ✅ E2E de expiração escrito e versionado
7. ✅ Lint, typecheck, build passam
8. ✅ Todos os testes executáveis passam
