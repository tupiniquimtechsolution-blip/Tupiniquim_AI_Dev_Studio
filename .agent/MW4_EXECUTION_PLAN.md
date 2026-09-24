# Master Wave 4 — Execution Plan

Data: 2026-09-24
Branch: `cloud/mw4-agent-registry-project-threads`
Issue: #40
PR: #41
Base: MW3 final HEAD `b1ddba47d907847003fa3fd3e1f07796da850703`
HEAD funcional auditado: `0b1a64efe6f55ab890f2d30d5156b362f0f936aa`

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

## Slices concluídos

### MW4.0 — Contratos e baseline — CONCLUÍDO

- schema Zod strict/versionado do `.agent/AGENT_REGISTRY.json`;
- validação fail-closed e ids únicos;
- schemas de assignment, team, thread binding, dispatch e capability gate;
- testes negativos de provider/model injection.

### MW4.1 — Registry Runtime — CONCLUÍDO

- `AgentRegistryRuntime` parseia o JSON canônico real;
- lookup/list/snapshot sem mutação do registry;
- provider/model injetados dentro de Agent são rejeitados;
- Agent/capability/effect desconhecidos falham fechado.

### MW4.2 — Agents → Projects — CONCLUÍDO

- aprovação explícita por projeto com `approvalRef`;
- `skillIds` são loadout metadata, sem instalação/execução automática;
- memory namespace derivado por `project + agent`;
- teams exigem Agents aprovados no mesmo projeto;
- disable revoga dispatch futuro.

### MW4.3 — Agents → Threads — CONCLUÍDO

- binding `project + agent + provider + model + threadId`;
- thread id não pode pertencer a outro projeto/agente/provider;
- dispatch exige provider/model explícitos;
- binding existente com model divergente exige rebind explícito.

### MW4.4 — Capability Gate — CONCLUÍDO

- effect precisa estar declarado no Agent;
- aliases aprovados MW4 são mapeados para capabilities canônicas (`workspace:write` → `workspace.write`; `process:execute` → `terminal.command`);
- PolicyEngine é consultado somente após o mapping canônico;
- mesmo quando Policy permite, o resultado mantém `runtimeExecutionAuthorized=false` e `requiresApproval=true`;
- efeitos declarados sem materializador MW4, como `asset:create`, permanecem metadata-only e negados;
- materialização real continua no fluxo PlanApprovalService/ApprovalStore/AuditLog.

### MW4.5 — Durabilidade e restart — CONCLUÍDO

- `AgentProjectJsonStore` persiste assignments/teams/thread bindings em `<dataRoot>/agent-runtime/project-state.json`;
- write é serializado e atômico por temp+rename;
- restart recupera binding, team e loadouts;
- isolamento de projeto continua após restart;
- AuditLog existente recebe eventos MW4;
- nenhum DDL/migration Supabase foi introduzido.

### MW4.6 — Quality + dogfood + handoff — FUNCIONALMENTE GREEN

Cloud Quality Gate run `36025944421` no HEAD funcional `0b1a64efe6f55ab890f2d30d5156b362f0f936aa`:
- lint: PASS;
- typecheck: PASS;
- unit: 259/259 PASS;
- integration: 103 PASS / 4 skips explícitos de ambiente/live;
- security: 48/48 PASS;
- dogfood: 12/12 PASS (MW3 A–K + MW4 Agent Studio);
- build: PASS;
- Cloudflare preview + MW0–MW5 dry-runs: PASS.

## Critério CLOUD-GREEN

A implementação funcional satisfaz o critério `CLOUD-GREEN`. O fechamento formal da Issue #40 ocorre somente após o HEAD documental final repetir o Cloud Quality Gate com sucesso.

`CLOUD-GREEN` continua sem equivaler a `RELEASE-GREEN`; certificações Windows reais permanecem independentes.
