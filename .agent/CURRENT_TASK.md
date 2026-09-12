# Tarefa atual

## Objetivo

Formalizar o checkpoint da **Wave 16 — restart/recovery da memória e sessão Tupiniquim** e preparar o gate final de dogfood/QA da Master Wave 1.

A implementação está concluída, o PR #23 foi mergeado e a Issue #18 foi fechada. Não há nova implementação autorizada nesta etapa.

## Identificação

- Branch canônica: `wave-16/restart-recovery-tupiniquim-session`
- PR #23: MERGEADO
- Merge commit: `d23a43e5543b455c59e193929122f332267fdf18`
- Issue #18: CLOSED / COMPLETED
- HEAD técnico validado no Windows F: `eba4dcc0f428c68ba086a7251375ef9f13b4c94f`
- `checkpoint/wave-16`: PENDENTE DE CRIAÇÃO

## Estado

- Master Wave 1: **EM ANDAMENTO**.
- Wave 16 Inc1–4: implementados, auditados, validados e mergeados.
- Windows F: `validate` GREEN.
- Windows F: Electron E2E real GREEN 4/4.
- Merge do PR #23: CONCLUÍDO.
- Issue #18: FECHADA.
- Checkpoint formal: aguardando somente a tag `checkpoint/wave-16`.
- Dogfood/QA final da Master Wave 1: PENDENTE.
- Master Wave 2: NÃO INICIADA.

Não realizar correções ou novas features sem nova evidência executável. O próximo trabalho funcional só começa após a tag do checkpoint.

## Evidência real — Windows F:

| Gate | Resultado |
|---|---|
| `pnpm-f.ps1 validate` | PASS integral |
| F:\CODEX-only | PASS |
| lint / typecheck | PASS |
| `pnpm test:unit` | 194/194 PASS |
| `pnpm test:integration` | 99 passed / 2 skipped |
| `tests/integration/tupiniquim-shutdown-restart.test.ts` | 4/4 PASS |
| `pnpm test:security` | 34/34 PASS |
| `pnpm build` | PASS |
| `pnpm-f.ps1 test:e2e` | 4/4 PASS · 0 failed · 0 skipped · 39.8s |

## Próxima ação

1. Criar e confirmar `checkpoint/wave-16` no HEAD atual da branch canônica.
2. Abrir/iniciar o gate final de dogfood/QA da Master Wave 1.
3. Não iniciar Master Wave 2 antes do fechamento desse gate.
