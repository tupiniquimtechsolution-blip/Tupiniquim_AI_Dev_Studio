# Changelog do Agente

## 2026-09-04 — Wave 14, provider-neutral tool protocol + proposal expiration safety

### Provider-neutral tool call protocol
- Added `NormalizedToolCallEnvelope` contract in packages/contracts/src/ai.ts — provider-neutral envelope decoupled from Ollama format
- Added `workspaceWriteArgsSchema` shared strict schema for business arguments (relativePath, content, operation) in contracts
- `OllamaAdapter.normalizeToolCall()` translates raw Ollama tool_calls → normalized envelope
- Adapter validates business arguments via `workspaceWriteArgsSchema.parse()` before calling proposal callback
- Adapter rejects non-object arguments (malformed Ollama responses)

### Canonical propose path
- Main process uses `proposeFromEnvelope()` instead of legacy `propose()` with manual parsing
- Flow: raw provider tool call → adapter structural normalization → NormalizedToolCallEnvelope → adapter business validation → privileged runtime → proposal service → manifest → approval → PolicyEngine → materialization

### Shared business argument validation
- `workspaceWriteArgsSchema` in contracts with `.strict()` — rejects extra fields, unknown operations, null bytes
- Both adapter and proposal service validate against the same shared schema
- Provider-neutral: no Ollama-specific validation in core

### Safe baseline lookup via dependency injection
- `WorkspaceBaselineLookup` interface injected into `WorkspaceWriteProposalService`
- Core never imports fs, path, or any adapter directly
- `inspectWriteTarget()` from WorkspaceAdapter uses path security (resolveLexicalPath + assertRealPathInside)
- CREATE validates that target does NOT exist; REPLACE validates that target exists with valid SHA-256 hash

### EXPIRED proposal status
- `proposalStatusValues` in contracts includes EXPIRED
- `lookupStatus()` uses `validateProposalState()` — same causal validation as `consume()`
- Unified causal validation: workspace drift, slot superseded, thread drift, turn drift, toolcall drift, manifest drift, payload drift
- Expired proposals are purged from memory; no file is written
- `proposalStatusInputSchema` IPC channel for renderer to query proposal status

### EXPIRED in UI
- Renderer uses `ProposalStatus` from contracts (removed local duplicate type)
- `lookupProposalStatus()` IPC bridges renderer → main → proposal service
- Replaced proposals show tombstone EXPIRED with public provenance
- Private content never crosses IPC

### Fixed 6 ollama unit test regressions
- Adapter now validates business arguments before calling proposal service callback
- Tests for DELETE operation, extra provenance, extra argument, missing field, wrong type, malformed JSON all pass

### New tests (6)
- CREATE target exists → rejected
- REPLACE target missing → rejected
- Proposal replaced → lookupStatus returns EXPIRED
- Workspace drift → EXPIRED
- Thread drift → EXPIRED
- Payload purged on expiration

### E2E expiration test
- Written in tests/e2e/desktop.spec.ts
- BLOCKED on Linux (requires F: drive, Electron display)
- Executable on Windows real machine

## 2026-09-04 — Wave 14, cross-platform test fixes

- Fixed 3 test files (terminal.test.ts, workspace.test.ts, path-security.test.ts) for cross-platform compatibility
- Added `isWindows` guards for Windows-only test paths (F: drive, LOCALAPPDATA)
- All 38 affected tests pass on Linux

## 2026-08-17 — Wave Mestre 1, consumo aprovado de propostas

- Adicionado canal IPC/preload tipado que recebe somente o id da proposta e materializa `workspace.write` apenas após a aprovação do manifesto, sem reenviar nem persistir o conteúdo pelo renderer.
- Antes da escrita, o processo principal relê a proveniência thread/turn, workspace e todos os campos do manifesto, reserva o efeito uma única vez, reavalia PolicyEngine e registra AuditLog/Flight Recorder redigidos.
- Propostas sem fonte, substituídas, alteradas ou obsoletas são invalidadas sem escrita; remetentes IPC não confiáveis também deixam auditoria de negação.
