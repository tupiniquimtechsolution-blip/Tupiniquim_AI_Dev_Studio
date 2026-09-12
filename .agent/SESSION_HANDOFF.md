# SESSION HANDOFF

Master Wave: 1 — Dev AI local autônomo (**EM ANDAMENTO**, ver `.agent/MASTER_PLAN.md`)
Wave 16: **FECHADA**
`checkpoint/wave-16`: **CRIADO E CONFIRMADO**
Checkpoint commit: `0b46bd60996aa6f87e495cffa8c4ff1bc4d1c0e8`
Wave 17: **DOGFOOD/QA FINAL EM ANDAMENTO**
Branch: `wave-17/master-wave-1-dogfood-qa`
Issue: #24 — `[MASTER WAVE 1] wave-17 — dogfood/QA final e gate de fechamento`
Master Wave 2: **NÃO INICIADA**

## Contexto

O GitHub é a fonte de verdade. A Wave 16 implementou restart/recovery local da Tupiniquim Session, passou os gates reais Windows F:, foi auditada, mergeada na branch canônica, teve a Issue #18 fechada e recebeu a tag anotada `checkpoint/wave-16`.

A Master Wave 1 ainda NÃO está concluída. O gate final obrigatório é a Wave 17 de dogfood/QA integrado.

## Baseline herdado da Wave 16

HEAD técnico Windows F: `eba4dcc0f428c68ba086a7251375ef9f13b4c94f`.

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

## Invariantes canônicas preservadas

- `Agent != Model != Provider != Tool != Skill != Source Repository`.
- `Tupiniquim Session != Provider Thread`.
- nenhuma provider thread cruza providers.
- nenhuma sessão/contexto cruza workspace.
- provider/model switch não troca memória, regras, workspace ou authority.
- snapshot SQLite v5 atômico por workspace.
- recovery/hydrate integral e fail-closed.
- retenção durável = últimos 200 turns públicos por workspace.
- seen-by-provider/ACK durável evita retransmissão indevida.
- proposals privadas/payload privado não persistem e não sobrevivem restart.
- workspaceContext/sessionContext são efêmeros por request.
- write-through estável é serializado/FIFO.
- ACK apenas após sucesso terminal.
- shutdown aguardável + runtime quiescence + barreira global IPC.
- providers fecham antes do database; database close é crítico.
- provider/model continuam escolha explícita do usuário.
- Terminal mutável e Git mutável continuam indisponíveis.

## Wave 17 — missão

Executar dogfood/QA real usando o produto como produto e validar:

1. startup/workspace real;
2. sessão/conversa;
3. multi-provider explícito;
4. restart/recovery;
5. A → B → A;
6. proposal/EXPIRED;
7. privacidade/persistência;
8. UX/estado;
9. `validate` + Electron E2E no Windows F:.

Cada achado deve ser classificado antes de correção. Não corrigir silenciosamente.

## Ponto de retomada

1. sincronizar a branch `wave-17/master-wave-1-dogfood-qa` no Windows F:;
2. confirmar working tree limpa e SHAs local/remoto;
3. executar `pnpm-f.ps1 validate`;
4. executar `pnpm-f.ps1 test:e2e`;
5. se GREEN, executar dogfood manual da Issue #24;
6. registrar achados e evidências;
7. correções somente se necessárias e delimitadas;
8. documentação final + auditoria externa;
9. somente então avaliar fechamento da Master Wave 1.

## Fora de escopo

Master Wave 2+, novos providers, Research/Knowledge/RAG, Agent Registry runtime, Skill Registry, Terminal/Git mutáveis, voz, multimodal e autonomous loop.
