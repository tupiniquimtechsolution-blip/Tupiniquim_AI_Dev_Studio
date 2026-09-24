# Master Wave 4 — Execution Plan

Data: 2026-09-24
Branch: `cloud/mw4-agent-registry-project-threads`
Issue: #40
Base: MW3 final HEAD `b1ddba47d907847003fa3fd3e1f07796da850703`

## Objetivo

Materializar o Tupiniquim AI Studio Agent Registry como runtime cloud-safe e provider-neutral, conectando Agents a Projects e Threads sem transformar metadata, loadout ou registry em autoridade de execução.

## Invariantes

1. `agent != model != provider != tool != skill != source_repository`.
2. Provider e model são escolhidos explicitamente fora da definição do Agent.
3. Um Agent aprovado para um projeto pode receber loadout/memory namespace daquele projeto, mas isso não concede permissão de efeito mutável.
4. Thread binding pertence ao triplo `project + agent + provider`; reutilização cross-project/cross-agent é bloqueada.
5. Troca de model exige rebind explícito quando existe binding de thread.
6. `effects` no Agent Registry são declarações de intenção/capability, nunca autoridade.
7. Capability mutável declarada passa por PolicyEngine e continua exigindo ApprovalStore/PlanApprovalService antes da materialização.
8. Todo gate relevante é auditável.
9. Source-registered Agents podem ser aprovados para um projeto como papéis/loadouts, mas isso não ativa providers, tools, skills ou paid services automaticamente.
10. Multimodal/voz/social automation permanecem fora do runtime efetivo da MW4; MW5 continua separada.

## Slices

### MW4.0 — Contratos e baseline

- schema Zod do `.agent/AGENT_REGISTRY.json`;
- validação fail-closed e ids únicos;
- schemas de assignment, team, thread binding, dispatch e capability gate;
- primeira suíte unitária negativa.

### MW4.1 — Registry Runtime

- `AgentRegistryRuntime` parseia JSON canônico;
- lookup/list/snapshot sem mutação do registry;
- provider/model injection dentro de Agent é rejeitada pelo schema strict;
- capability/effect desconhecidos falham fechado.

### MW4.2 — Agents → Projects

- aprovação explícita por projeto com `approvalRef`;
- `skillIds` como loadout metadata, sem instalação/execução automática;
- memory namespace derivado por `project + agent`;
- teams exigem Agents aprovados no mesmo projeto;
- disable revoga dispatch futuro.

### MW4.3 — Agents → Threads

- binding `project + agent + provider + model + threadId`;
- thread id não pode pertencer a outro projeto/agente/provider;
- dispatch exige provider/model explícitos;
- binding existente com model divergente exige rebind explícito.

### MW4.4 — Capability Gate

- effect precisa estar declarado no Agent;
- PolicyEngine é consultado;
- mesmo quando Policy permite, effect de Agent retorna `runtimeExecutionAuthorized=false` e `requiresApproval=true`;
- materialização real continua no fluxo PlanApprovalService/ApprovalStore/AuditLog.

### MW4.5 — Durabilidade e restart

- adicionar storage local para assignments/teams/thread bindings ou justificar explicitamente qualquer deferência;
- restart preserva bindings sem cruzar projetos;
- qualquer migration é local SQLite apenas; nenhum DDL Supabase implícito.

### MW4.6 — Quality + dogfood + handoff

- unit/integration/security;
- dogfood MW4 para registry → project → team → thread → dispatch → capability gate;
- lint/typecheck/build;
- Cloudflare preview + MW0–MW5 dry-runs;
- diff/security review;
- STATUS/MASTER_PLAN/TEST_RESULTS/HANDOFF;
- Issue #40 só fecha após o HEAD documental final repetir GREEN.

## Critério CLOUD-GREEN

A MW4 só fecha quando todos os slices acima estiverem comprovados por CI e nenhuma diferença entre Agent metadata e autoridade de execução tiver sido apagada ou simplificada.

`CLOUD-GREEN` continua sem equivaler a `RELEASE-GREEN`; certificações Windows reais permanecem independentes.
