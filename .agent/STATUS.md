# Status

Atualizado em: 2026-09-04

## Estado atual

- Master Wave: 1 — Dev AI local autônomo (EM ANDAMENTO, ver .agent/MASTER_PLAN.md)
- Checkpoint candidate: wave-14 — Provider-neutral tool protocol + proposal provenance + expiration safety
- Current branch: arena/01a06d79-tupiniquim-ai-dev-studio (continuação corretiva do PR #12; HEAD de auditoria 312c674)
- PR de continuação: aberto a partir desta branch; referencia Issue #11 e PR #12
- Repositório operacional (máquina real): F:\CODEX\Tupiniquim-AI-Dev-Studio
- Dados: F:\CODEX\Tupiniquim-AI-Dev-Studio.data

## Contexto de onda

- O MASTER_PLAN mantém a **Master Wave 1 em andamento**. "wave-14" é o candidato a
  checkpoint interno dessa Master Wave 1, NÃO uma nova wave mestre.
- Terminal mutável e Git mutável continuam INDISPONÍVEIS. Não se avança para
  "Wave 15 / autonomous loop" antes de fechar este checkpoint.

## Gates atuais (comandos oficiais)

    pnpm lint
    pnpm typecheck
    pnpm test:unit
    pnpm test:security
    pnpm test:integration
    pnpm build
    (Windows F:) powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pnpm-f.ps1 validate
    (Windows F:) pnpm test:e2e

### Resultados no Arena (Linux) — execução real

- lint: ✅ PASS
- typecheck: ✅ PASS
- build: ✅ PASS
- unit: 38/38 no núcleo novo; suíte total 45/46 (1 falha PRÉ-EXISTENTE F:\CODEX do visual-intelligence, fora de escopo)
- security: 33/34 (1 falha PRÉ-EXISTENTE TEMP indisponível no Linux, fora de escopo)
- integration: 7/7 novos testes cross-platform PASSAM no Linux; suíte legada permanece com falhas F:-gated (pré-existentes)
- Novos testes cross-platform (rodam em qualquer SO, sem F:/SQLite):
  - packages/core/src/workspace-write-proposal.unit.test.ts (8 testes)
  - tests/integration/workspace-write-proposal.test.ts (7 testes, WorkspaceAdapter real)

### BLOCKED — requer máquina Windows real (F:)

- tests/integration/persistence.test.ts (SQLite em F:; inclui os testes de drift/purge
  agora corrigidos, mas gated por F:)
- E2E completo (tests/e2e/desktop.spec.ts), incluindo o E2E de expiração.
  No Linux o E2E de expiração reporta SKIP explícito (não PASS falso).
- Estes NÃO foram executados no Arena; status aceitável é BLOCKED.

## Correções aplicadas nesta continuação (4ª auditoria, HEAD 312c674)

1. **Baseline FAIL CLOSED** — removido o catch genérico que transformava erro de
   inspeção/path em "alvo inexistente". Erros de WorkspaceAdapter.inspectWriteTarget()
   (traversal, absoluto, symlink, namespace, permissão, inesperado) agora recusam a
   proposta. Somente {exists:false,hash:null} real significa inexistente.
2. **Purge garantido no EXPIRED** — lookupStatus() chama invalidate(id) também no
   caminho de exceção; payload efêmero nunca permanece na memória após EXPIRED.
3. **Testes de persistência** — workspace drift agora usa a mesma instância com
   getWorkspaceRoot() mutável; teste de purge provoca expiração real antes de
   lookup/consume.
4. **E2E de expiração** — gate vira test.skip explícito (sem retorno silencioso);
   tombstone de A localizado por ID (A=EXPIRED, B=PENDING_REVIEW); marcadores
   privados A/B varridos em DOM, conversation, Flight Recorder/events, agent
   history, AuditLog e SQLite.
5. **Documentação** — CHANGELOG_AGENT.md restaurado com todo o histórico de
   origin/main + Wave 14 adicionada; STATUS/NEXT_ACTION/HANDOFF reconciliados.

## Preservado (arquitetura já aprovada — não refatorado)

NormalizedToolCallEnvelope; workspaceWriteArgsSchema strict; protocolo
provider-neutral; proposeFromEnvelope(); WorkspaceBaselineLookup via DI;
WorkspaceAdapter.inspectWriteTarget(); ProposalStatus com EXPIRED;
lookupProposalStatus IPC; tombstone público; validação do adapter Ollama;
PolicyEngine; ApprovalStore/PlanApprovalService; AuditLog; payload privado só em
memória; Terminal mutável indisponível; Git mutável indisponível.

## Próximo (ordem estrita, sem avanço de escopo)

1. Executar na máquina Windows real F: `scripts\pnpm-f.ps1 validate`.
2. Executar `pnpm test:e2e` na máquina Windows real.
3. Quinta auditoria externa sobre os resultados.
4. Somente se aprovado: merge/checkpoint wave-14.
5. Só então definir a próxima unidade conforme o MASTER_PLAN (Master Wave 1 segue).

## Bloqueios externos

- OPENAI_API_NO_CREDITS bloqueia somente inferência live paga; não invalida o transporte controlado.
- Provedores visuais pagos permanecem NOT_CONFIGURED.
- Persistence/E2E requerem F: drive (Windows) — BLOCKED no ambiente Linux do Arena.
