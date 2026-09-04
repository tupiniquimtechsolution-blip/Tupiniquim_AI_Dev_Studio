# SESSION HANDOFF

Master Wave: 1 — Dev AI local autônomo (EM ANDAMENTO, ver .agent/MASTER_PLAN.md)
Checkpoint candidate: wave-14 — Provider-neutral tool protocol + proposal provenance + expiration safety
Branch: arena/01a06d79-tupiniquim-ai-dev-studio (continuação corretiva)
Base de auditoria: 312c674 (freebuff/wave-14-proposal-tool-provenance, PR #12)
Refs: Issue #11, PR #12 (PR de continuação referencia ambos)

## Contexto

O GitHub é a fonte de verdade. Esta sessão NÃO recomeçou o projeto: partiu do
HEAD auditado 312c674 e aplicou apenas as correções da 4ª auditoria. A
arquitetura já aprovada foi preservada.

## Correções aplicadas (5 bloqueios da 4ª auditoria)

1. **Baseline FAIL CLOSED** — `WorkspaceWriteProposalService.lookupTargetBaseline()`
   não engole mais exceções. Erro de inspeção/path do
   `WorkspaceAdapter.inspectWriteTarget()` propaga e recusa a proposta; só
   `{exists:false,hash:null}` real significa inexistente.
2. **Purge no EXPIRED** — `lookupStatus()` chama `invalidate(id)` também no catch;
   nenhum payload efêmero fica em memória após EXPIRED.
3. **Testes de persistência** — workspace drift usa a MESMA instância com
   getWorkspaceRoot() mutável; purge provoca expiração real antes de lookup/consume.
4. **E2E de expiração** — gate `test.skip(condição, motivo)` explícito (sem retorno
   silencioso/PASS falso); tombstone de A localizado por ID; B separado; marcadores
   privados A/B varridos em DOM, conversation, Flight Recorder/events, agent
   history, AuditLog e SQLite.
5. **Documentação** — CHANGELOG_AGENT.md restaurado integralmente do origin/main
   com a Wave 14 adicionada no topo; STATUS/NEXT_ACTION/HANDOFF reconciliados para
   distinguir Master Wave 1 de checkpoint candidate wave-14.

## Testes novos cross-platform (executados verdes no Linux/Arena)

- packages/core/src/workspace-write-proposal.unit.test.ts (8 testes, unit)
- tests/integration/workspace-write-proposal.test.ts (7 testes, integration,
  WorkspaceAdapter REAL + diretório temporário real)

## Resultados no Arena (Linux)

- lint ✅, typecheck ✅, build ✅.
- unit: suíte nova 8/8; suíte total com 1 falha PRÉ-EXISTENTE (visual-intelligence
  exige F:\CODEX) fora de escopo.
- security: 33/34, 1 falha PRÉ-EXISTENTE (TEMP indisponível no Linux).
- integration: novos 7/7 verdes; legados F:-gated seguem BLOCKED no Linux.

## Pending — BLOCKED para máquina Windows real (F:)

- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pnpm-f.ps1 validate`
- `pnpm test:e2e` (inclui E2E de expiração)
- tests/integration/persistence.test.ts (SQLite em F:)
- Quinta auditoria externa; depois merge/checkpoint se aprovado.

## Fora de escopo (NÃO implementar agora)

Novos providers (Qwen, Kimi, Gemini, DeepSeek, Claude, Grok), Model/Provider
Registry completo, Agent Registry runtime, Google Skills runtime (PR #13
separado), Terminal mutável, Git mutável, voz, multimodal, autonomous loop.

## External blockers

- OPENAI_API_NO_CREDITS para inferência live paga.
- Persistence/E2E tests require F: drive (Windows only).
