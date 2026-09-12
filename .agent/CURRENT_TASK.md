# Tarefa atual

## Objetivo

Fechamento documental e preparação do merge controlado da **Wave 16 — restart/recovery da memória e sessão Tupiniquim**.

A implementação e os gates reais já foram concluídos. Esta etapa é **docs-only**:
nenhuma nova feature, nenhuma alteração de runtime, nenhum teste alterado e nenhum
merge.

## Identificação

- Branch canônica: `arena/wave-16-inc4-shutdown-restart`
- PR: #23 — OPEN / NÃO MERGEADO
- Issue: #18 — OPEN
- HEAD técnico validado no Windows F: `eba4dcc0f428c68ba086a7251375ef9f13b4c94f`
- Estado: `IMPLEMENTATION_AND_REAL_MACHINE_GATES_COMPLETE`

## Estado

- Master Wave 1: **EM ANDAMENTO**.
- Wave 16 Inc1–4: implementados e auditados tecnicamente.
- Windows F: `validate` GREEN.
- Windows F: Electron E2E real GREEN 4/4.
- Documentação final: em fechamento/auditoria.
- Merge do PR #23: PENDENTE.
- Issue #18: ABERTA.
- `checkpoint/wave-16`: NÃO CRIADO.
- Dogfood/QA final da Master Wave 1: PENDENTE.
- Master Wave 2: NÃO INICIADA.

O código fica congelado no HEAD técnico aprovado. Não realizar correções adicionais
sem nova evidência executável de regressão.

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

1. Auditoria externa do conjunto documental `.agent/*`.
2. Se aprovado, merge controlado do PR #23.
3. Confirmar estado pós-merge.
4. Fechar Issue #18.
5. Criar tag `checkpoint/wave-16`.
6. Somente então executar o dogfood/QA final da Master Wave 1.

Não iniciar Master Wave 2 e não ampliar escopo nesta alteração.
