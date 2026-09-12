# Status

Atualizado em: 2026-09-12

## Estado atual

- Master Wave: 1 — Dev AI local autônomo (**EM ANDAMENTO**, ver `.agent/MASTER_PLAN.md`)
- Wave 16 — restart/recovery da memória e sessão Tupiniquim: **IMPLEMENTAÇÃO E GATES CONCLUÍDOS; MERGE FORMAL CONCLUÍDO**
- Branch canônica: `wave-16/restart-recovery-tupiniquim-session`
- PR #23: **MERGEADO**
- Merge commit: `d23a43e5543b455c59e193929122f332267fdf18`
- Issue #18: **CLOSED / COMPLETED**
- HEAD técnico validado no Windows F: `eba4dcc0f428c68ba086a7251375ef9f13b4c94f`
- Repositório operacional: `F:\CODEX\Tupiniquim-AI-Dev-Studio`
- Dados operacionais: `F:\CODEX\Tupiniquim-AI-Dev-Studio.data`
- `checkpoint/wave-16`: **PENDENTE DE CRIAÇÃO**
- Dogfood/QA final da Master Wave 1: **PENDENTE**
- Master Wave 2: **NÃO INICIADA**

## Situação da Wave 16

Os incrementos 1–4 estão implementados, auditados e mergeados na branch canônica da Wave 16. A Issue #18 foi fechada como completed após o merge. O único item restante para formalizar o checkpoint é criar a tag `checkpoint/wave-16` no HEAD pós-merge/documentação.

A Wave 16 **não encerra a Master Wave 1**. Após o checkpoint ainda é obrigatório executar o gate final de dogfood/QA da Master Wave 1. Master Wave 2 não deve ser iniciada antes desse gate.

## Gates Windows F: — evidência autoritativa (HEAD técnico `eba4dcc`)

| Gate | Resultado |
|---|---|
| `pnpm-f.ps1 validate` | PASS integral |
| F:\CODEX-only | PASS |
| lint | PASS |
| typecheck | PASS |
| `pnpm test:unit` | 194/194 PASS |
| `pnpm test:integration` | 99 passed / 2 skipped |
| `tests/integration/tupiniquim-shutdown-restart.test.ts` | 4/4 PASS |
| `pnpm test:security` | 34/34 PASS |
| `pnpm build` | PASS |
| `pnpm-f.ps1 test:e2e` | 4/4 PASS · 0 failed · 0 skipped · 39.8s |

## Electron E2E real (Windows F:)

1. inicia o Electron seguro e carrega um workspace real — PASS — 9.7s
2. proposta substituída fica EXPIRED e aplicação da antiga é recusada — PASS — 5.7s
3. sessão Tupiniquim sobrevive à troca de provider fake e isola workspace — PASS — 7.5s
4. shutdown aguardável encerra o processo REAL e o restart recupera a mesma Tupiniquim Session — PASS — 13.0s

## Invariantes Wave 16 comprovados

- `Tupiniquim Session != Provider Thread`
- troca de provider/modelo não troca memória, regras, workspace ou autoridade do projeto
- nenhuma provider thread é reutilizada cross-provider
- nenhuma sessão cruza workspace
- snapshot SQLite v5 atômico por workspace
- recovery/hydrate integral e fail-closed
- retenção durável de até 200 turns públicos com poda coerente de `seenByProvider`
- provider bindings e seen-by-provider recuperados com provenance
- proposal privada/payload privado não persistem
- proposal authority não sobrevive restart
- workspace context e session context são efêmeros por request
- write-through serializado/FIFO para mutações estáveis
- shutdown aguardável e one-shot
- runtime quiescence antes do flush/close
- barreira global de IPC com selo OPEN → SEALED
- providers são fechados antes do database
- database close é crítico; falha aborta o shutdown normal
- dataRoot E2E é isolado do dataRoot operacional
- marcadores privados ausentes de DOM, conversation, snapshot, AI history, Flight Recorder, AuditLog, logs e SQLite/WAL nos cenários cobertos

## Histórico do gate final

Os gates Windows F: expuseram dois problemas de sincronização no harness E2E, ambos corrigidos sem mudança de produção:

1. **workspace readiness** — corrigido no commit `7c9c01d` com espera bounded por estado real.
2. **provider/model readiness** — corrigido no commit `eba4dcc` com espera por `READY` + controles habilitados.

O resultado final autoritativo é 4/4 E2E PASS no Windows F:.

## Preservado

PolicyEngine; ApprovalStore/PlanApprovalService; AuditLog; payload privado somente em memória; renderer sem autoridade privilegiada; Terminal mutável indisponível; Git mutável indisponível; seleção de provider/modelo continua explícita e controlada pelo usuário.

## Próximo passo

1. Criar tag `checkpoint/wave-16` no HEAD atual da branch canônica.
2. Confirmar a tag.
3. Abrir/iniciar o gate final de dogfood/QA da Master Wave 1.
4. Não iniciar Master Wave 2 antes do fechamento desse gate.
