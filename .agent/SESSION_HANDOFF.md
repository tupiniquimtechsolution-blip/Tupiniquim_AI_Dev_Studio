# SESSION HANDOFF

Wave: Wave 14 — Provider-neutral tool protocol + proposal provenance + expiration safety
Checkpoint: candidato checkpoint/wave-14 (aguardando gates finais)
Branch: freebuff/wave-14-proposal-tool-provenance
PR: #12 (Ref #11)

## Completed (Wave 14)

- NormalizedToolCallEnvelope — contrato provider-neutral em contracts/ai.ts
- workspaceWriteArgsSchema — validação compartilhada de business arguments com .strict()
- WorkspaceBaselineLookup — injeção de dependência para inspeção de baseline segura
- OllamaAdapter.normalizeToolCall() — traduz tool_calls Ollama → envelope normalizado
- Adapter-level validation: workspaceWriteArgsSchema.parse() antes do callback
- proposeFromEnvelope() — caminho canônico provider-neutral no main process
- validateProposalState() — validação causal unificada para lookupStatus() e consume()
- EXPIRED status — proposta substituída recebe EXPIRED via IPC lookupProposalStatus
- Tombstone EXPIRED na UI com proveniência pública sem conteúdo
- 6 ollama unit test regressions fixed (adapter validates args before callback)
- E2E expiration test written (BLOCKED on Linux)
- 6 new unit/integration tests: CREATE exists, REPLACE missing, EXPIRED substitution, workspace drift, thread drift, payload purge

## Pending

- E2E execution on Windows real machine
- Wave 15: terminal controlado → tool loop → Git controlado → autonomous development loop

## External blockers

- OPENAI_API_NO_CREDITS para inferência live paga.
- Persistence tests require F: drive (Windows only).
