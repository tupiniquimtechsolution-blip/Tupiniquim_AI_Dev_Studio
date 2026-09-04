# Status

Atualizado em: 2026-09-04

## Estado atual

- Current wave: Wave 14 — Provider-neutral tool protocol + proposal provenance + expiration safety
- Current checkpoint: candidato checkpoint/wave-14 (aguardando gates finais)
- Current branch: freebuff/wave-14-proposal-tool-provenance
- PR: #12 (Ref #11)
- Repositório operacional: F:\CODEX\Tupiniquim-AI-Dev-Studio
- Dados: F:\CODEX\Tupiniquim-AI-Dev-Studio.data

## Gates atuais

    pnpm lint
    pnpm typecheck
    pnpm test:unit
    pnpm test:security
    pnpm test:integration
    pnpm build

- lint: ✅ PASS
- typecheck: ✅ PASS
- build: ✅ PASS
- unit: ✅ 37/38 (1 pre-existing F: drive failure)
- security: ✅ 33/34 (1 pre-existing TEMP env issue)
- integration: ✅ 11/30 (19 pre-existing F: drive failures, incluindo 6 novos testes ambientais)

## Concluído na Wave 14 (esta branch)

### Provider-neutral tool call protocol
- `NormalizedToolCallEnvelope` contrato em contracts/ai.ts — envelope sem acoplamento ao formato Ollama
- `workspaceWriteArgsSchema` schema compartilhado para business arguments (relativePath, content, operation) com `.strict()`
- `OllamaAdapter.normalizeToolCall()` traduz tool_calls Ollama → envelope normalizado
- Adapter valida business arguments via `workspaceWriteArgsSchema.parse()` antes do callback

### Proveniência causal completa
- Proposal provenance: provider, thread, turn, tool call, execution, step, manifest, target, operation, hash, baseline
- `AgentProposalEffectSourceSchema` vincula proposal → manifest → manifest effects
- Replay protegido por toolCallId dedup

### EXPIRED proposal status
- `proposalStatusValues` inclui EXPIRED no contrato
- `lookupStatus()` usa `validateProposalState()` — mesma validação causal de `consume()`
- Validação causal unificada: workspace drift, slot superseded, thread drift, turn drift, toolcall drift, manifest drift, payload drift
- Proposta expirada é removida da memória e não escreve arquivo

### Segurança removida do core
- `WorkspaceBaselineLookup` interface injetada — core não importa fs
- `inspectWriteTarget()` do adapter usa path security (resolveLexicalPath + assertRealPathInside)
- CREATE valida que alvo não existe; REPLACE valida que alvo existe com hash válido

### Canonical propose path
- Main process usa `proposeFromEnvelope()` em vez de `propose()` legado
- Canvas proposal → envelope → proposal service → manifest → approval → materialization

### EXPIRED na UI
- Renderer usa `ProposalStatus` de contracts (não tipo local duplicado)
- IPC `lookupProposalStatus` delega ao processo privilegiado
- Propostas substituídas mostram tombstone EXPIRED com proveniência pública
- Conteúdo privado nunca cruza IPC

### Ollama unit tests
- 24/24 passam (6 anteriormente quebradas agora corrigidas)

### E2E test
- Teste de expiração escrito em tests/e2e/desktop.spec.ts
- BLOCKED neste ambiente (Linux, sem F:, sem display Electron)
- Executável na máquina Windows real

## Próximo

Wave 15: terminal controlado → tool loop → Git controlado → autonomous development loop.

## Bloqueios externos

- OPENAI_API_NO_CREDITS bloqueia somente inferência live paga; não invalida o transporte controlado.
- Provedores visuais pagos permanecem NOT_CONFIGURED.
- Persistence/security/terminal tests requerem F: drive (Windows) — BLOCKED neste ambiente Linux.
