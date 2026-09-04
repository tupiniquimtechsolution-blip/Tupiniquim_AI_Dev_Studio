# Próxima ação

Master Wave: **1 (EM ANDAMENTO)** · Checkpoint candidate: **wave-14**.
Não avançar para Terminal/Git/autonomous loop antes de fechar este checkpoint.

1. **Máquina Windows real (F:)**: executar
   `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pnpm-f.ps1 validate`
   (lint + typecheck + unit + integration + security + build sob o gate F:).
2. **Máquina Windows real (F:)**: executar `pnpm test:e2e` (ou o wrapper E2E
   vigente), incluindo o E2E de expiração (A→B substituição, A=EXPIRED,
   apply(A) falha, sem escrita de A, marcadores privados ausentes de DOM,
   conversation, Flight Recorder/events, agent history, AuditLog e SQLite).
3. Rodar os testes de persistência gated por F: (drift na mesma instância e
   purge com expiração real) na máquina Windows.
4. Solicitar a **quinta auditoria externa** sobre os resultados reais.
5. Somente se aprovado: merge/checkpoint de wave-14.
6. Só então definir a próxima unidade de trabalho conforme `.agent/MASTER_PLAN.md`
   (a Master Wave 1 continua; Waves 2–3 vêm antes de Agent Runtime/hardening
   avançado). Terminal mutável e Git mutável seguem INDISPONÍVEIS.

## Evidência já coletada no Arena (Linux)

- lint ✅, typecheck ✅, build ✅.
- Novos testes cross-platform (rodam sem F:/SQLite): 8 unitários + 7 de
  integração com WorkspaceAdapter real — todos PASSAM no Linux.
- E2E de expiração reporta SKIP explícito no Linux (não há PASS falso).

## Status BLOCKED (não alegar PASS)

- `tests/integration/persistence.test.ts` e os E2E (tests/e2e/desktop.spec.ts)
  não foram executados no Windows F: pelo Arena — única saída aceitável é
  **BLOCKED** até a execução real na máquina Windows.
