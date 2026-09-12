# SESSION HANDOFF

Master Wave: 1 — Dev AI local autônomo (**EM ANDAMENTO**, ver `.agent/MASTER_PLAN.md`)
Wave 16: **IMPLEMENTATION_AND_REAL_MACHINE_GATES_COMPLETE**
Branch canônica do PR: `arena/wave-16-inc4-shutdown-restart`
PR: #23 — OPEN / NÃO MERGEADO
Issue: #18 — OPEN
HEAD técnico validado no Windows F: `eba4dcc0f428c68ba086a7251375ef9f13b4c94f`
`checkpoint/wave-16`: NÃO CRIADO
Dogfood/QA final da Master Wave 1: PENDENTE
Master Wave 2: NÃO INICIADA

## Contexto

O GitHub é a fonte de verdade. A Wave 16 implementa restart/recovery local da
Tupiniquim Session e fechou os gates técnicos na máquina Windows `F:`. O código está
congelado no HEAD técnico aprovado; esta etapa é exclusivamente documental e serve
para auditoria externa antes do merge controlado.

Não declarar a Wave 16 formalmente fechada antes de merge + Issue #18 + tag.
Não declarar a Master Wave 1 concluída antes do dogfood/QA final.

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

1. Primeira execução do novo restart E2E expôs timeout de workspace readiness com SQLite fresco. Correção exclusivamente no harness: `7c9c01d`.
2. Execução seguinte chegou a 3/4 PASS e expôs race de provider/model readiness (MESSAGE_DELTA antes de TURN_COMPLETED). Correção exclusivamente no harness: `eba4dcc`.
3. Execução autoritativa final no Windows F: 4/4 PASS.

Nenhuma mudança de produção foi necessária para esses dois últimos problemas do harness.

## Ponto de retomada

1. Auditar externamente o diff documental `.agent/*`.
2. Se aprovado, merge controlado do PR #23 na branch `wave-16/restart-recovery-tupiniquim-session`.
3. Confirmar o SHA pós-merge.
4. Fechar Issue #18.
5. Criar tag anotada `checkpoint/wave-16`.
6. Executar o dogfood/QA final da Master Wave 1.
7. Somente após o dogfood considerar Master Wave 2.

## Fora de escopo agora

Novos providers; Agent Registry runtime; Skill Registry; RAG/Knowledge; Terminal
mutável; Git mutável; voz; multimodal; autonomous loop; persistência de segredos;
novas features durante o fechamento.

## External blockers não relacionados ao fechamento da Wave 16

- OPENAI_API_NO_CREDITS afeta apenas inferência live paga; não invalida os gates controlados.
