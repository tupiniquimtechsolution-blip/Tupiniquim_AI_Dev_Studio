# SESSION HANDOFF

Master Wave: 1 — Dev AI local autônomo (**EM ANDAMENTO**, ver `.agent/MASTER_PLAN.md`)
Wave 16: implementação + gates + documentação + merge **CONCLUÍDOS**
Branch canônica: `wave-16/restart-recovery-tupiniquim-session`
PR #23: MERGEADO
Merge commit: `d23a43e5543b455c59e193929122f332267fdf18`
Issue #18: CLOSED / COMPLETED
HEAD técnico validado no Windows F: `eba4dcc0f428c68ba086a7251375ef9f13b4c94f`
`checkpoint/wave-16`: PENDENTE DE CRIAÇÃO
Dogfood/QA final da Master Wave 1: PENDENTE
Master Wave 2: NÃO INICIADA

## Contexto

O GitHub é a fonte de verdade. A Wave 16 implementou restart/recovery local da Tupiniquim Session, passou os gates reais na máquina Windows `F:`, foi auditada externamente, teve o PR #23 mergeado na branch canônica e a Issue #18 fechada como completed.

O checkpoint formal ainda depende da criação da tag `checkpoint/wave-16`. A Master Wave 1 só poderá ser considerada concluída depois do gate final de dogfood/QA.

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

### Electron E2E

1. Electron seguro + workspace real — PASS — 9.7s
2. proposal substituída EXPIRED; aplicação da antiga recusada — PASS — 5.7s
3. Tupiniquim Session sobrevive à troca de provider fake e isola workspace — PASS — 7.5s
4. shutdown real + restart recupera a mesma Tupiniquim Session — PASS — 13.0s

## Invariantes canônicas da Wave 16

- `Agent != Model != Provider != Tool != Skill != Source Repository`.
- `Tupiniquim Session != Provider Thread`.
- provider/model switch não troca memória, regras, workspace ou autoridade do projeto.
- nenhuma provider thread cruza providers.
- nenhuma sessão/contexto cruza workspace.
- snapshot SQLite v5 é atômico por workspace.
- recovery/hydrate é integral e fail-closed.
- retenção durável = últimos 200 turns públicos por workspace; `seenByProvider` é podado no mesmo snapshot.
- provider bindings e provenance provider/model/thread/turn são revalidados.
- seen-by-provider/ACK durável evita retransmissão de contexto já concluído.
- proposals privadas e payload privado nunca entram no snapshot.
- proposal authority morre no restart.
- workspaceContext e sessionContext são efêmeros por request.
- write-through de mutações estáveis é serializado/FIFO.
- assistant parcial e failed/cancelled não viram snapshot terminal durável.
- ACK ocorre somente em sucesso terminal.
- shutdown é aguardável, one-shot e bounded.
- runtime quiescence precede flush final e fechamento de recursos.
- barreira global de IPC sela novas operações e aguarda as já iniciadas.
- providers críticos fecham antes do database.
- database close é crítico; falha resulta em ABORTED/exit 1.
- dataRoot E2E é isolado do operacional; processo 1 e processo 2 usam o mesmo root do cenário de restart.
- marcador privado permanece ausente de DOM, conversation, snapshot, AI history, Flight Recorder, AuditLog, logs e SQLite/WAL nos cenários cobertos.

## Histórico relevante do gate final

1. Workspace readiness com SQLite fresco foi corrigido somente no harness em `7c9c01d`.
2. Provider/model readiness foi corrigido somente no harness em `eba4dcc`.
3. Execução autoritativa final no Windows F: 4/4 PASS.
4. PR #23 mergeado no commit `d23a43e5543b455c59e193929122f332267fdf18`.
5. Issue #18 fechada como completed.

## Ponto de retomada

1. Criar e confirmar a tag anotada `checkpoint/wave-16` no HEAD atual da branch canônica.
2. Abrir/iniciar o gate final de dogfood/QA da Master Wave 1.
3. Bugs reais encontrados pelo dogfood devem virar issues próprias; não ampliar escopo silenciosamente.
4. Somente após dogfood/QA GREEN avaliar encerramento da Master Wave 1 e preparação da Master Wave 2.

## Fora de escopo agora

Novos providers; Agent Registry runtime; Skill Registry; RAG/Knowledge; Terminal mutável; Git mutável; voz; multimodal; autonomous loop; persistência de segredos; novas features antes do dogfood final.

## External blockers não relacionados ao fechamento da Wave 16

- OPENAI_API_NO_CREDITS afeta apenas inferência live paga; não invalida os gates controlados.
