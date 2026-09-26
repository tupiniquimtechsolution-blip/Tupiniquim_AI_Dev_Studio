# Master Wave 4 — Handoff

Data: 2026-09-24
Estado funcional: **CLOUD-GREEN**
Branch: `cloud/mw4-agent-registry-project-threads`
PR: #41 — DRAFT / NÃO MERGEADO
Issue: #40
HEAD funcional: `0b1a64efe6f55ab890f2d30d5156b362f0f936aa`
Cloud Quality Gate: `36025944421` — PASS

## O que a MW4 entregou

### 1. Agent Registry executável e fail-closed

O arquivo `.agent/AGENT_REGISTRY.json` deixou de ser apenas documentação de configuração e passou a ter contrato runtime Zod strict por `AgentRegistryRuntime`.

Mantido como invariante:

`agent != model != provider != tool != skill != source_repository`

O registry descreve papel, capabilities, effects, constraints e sources. Ele não escolhe provider/model e não concede autoridade de mutação.

### 2. Agents → Projects

`AgentProjectRuntime` materializa aprovação explícita do Agent por projeto:
- `approvalRef` obrigatório para ativação;
- loadout `skillIds` isolado por projeto;
- memory namespace `project + agent`;
- teams limitados a Agents já aprovados naquele projeto;
- disable revoga dispatch futuro.

### 3. Agents → Threads

Thread binding é externo à definição do Agent e contém:
- project;
- agent;
- provider;
- model;
- thread id.

Provider/model continuam user-controlled. Cross-project/cross-agent/provider thread reuse é negado. Mudança de model em binding existente exige rebind explícito.

### 4. Capability Gate sem autoridade implícita

Effects do registry são metadata/intenção.

A MW4 aprova materialização apenas para aliases canônicos já existentes no sistema:
- `workspace:write` → `workspace.write`;
- `process:execute` → `terminal.command`.

Mesmo nesses casos:
- PolicyEngine decide;
- `runtimeExecutionAuthorized=false` permanece na saída do Agent Runtime;
- ação mutável permitida por Policy ainda exige ApprovalStore/PlanApprovalService antes da materialização;
- AuditLog continua obrigatório no fluxo privilegiado.

Effects de waves futuras — `asset:create`, `asset:edit`, social/voice etc. — permanecem metadata-only e sem materializador MW4.

### 5. Persistência/restart

`AgentProjectJsonStore` persiste estado local no data root:

`<dataRoot>/agent-runtime/project-state.json`

Persistidos:
- assignments;
- teams;
- thread bindings.

Write serializado + temp/rename evita estado parcial. Restart foi exercitado em integration e dogfood.

### 6. Audit

`AgentRuntimeAuditAdapter` conecta eventos do runtime ao `AuditLog` já existente sem criar um subsistema paralelo de autoridade.

## Evidência

Run funcional `36025944421`:
- lint PASS;
- typecheck PASS;
- unit 259/259;
- integration 103 PASS / 4 skips explícitos;
- security 48/48;
- dogfood 12/12;
- build PASS;
- Cloudflare preview + MW0–MW5 dry-runs PASS.

Dogfood MW4 executa:

`canonical registry → projects A/B → assignments/loadouts → team → thread → dispatch → capability gate → cross-project denial → restart → resume`

## Correções feitas pelo gate

1. imports usados apenas como types foram convertidos para `import type`.
2. `AgentCapabilityGateResult` strict inicialmente rejeitou detalhes internos do intent; o resultado público foi estreitado em vez de relaxar o schema.

Essas correções preservam o desenho fail-closed.

## Supabase / Cloudflare / Drive

- nenhum DDL/migration Supabase aplicado;
- nenhum secret versionado;
- Cloudflare permanece control-plane/preview e não substitui runtime Windows;
- estado Cloudflare das MW2–MW4 é reconciliado para `WAVE_STATE=CLOUD_GREEN`, mantendo `RELEASE_STATE=WINDOWS_DEFERRED`;
- Drive continua acervo/input, nunca fonte de verdade ou storage de secrets.

## Windows

MW4 `CLOUD-GREEN` não promove RC1 para `RELEASE-GREEN`.

Continuam independentes quando aplicáveis:
- Electron físico;
- ConPTY/PTY;
- Windows package;
- Ollama/hardware local;
- OAuth/consentimento humano.

## Próxima wave

Após o HEAD documental final da MW4 repetir GREEN, Master Wave 5 pode iniciar na trilha cloud conforme o `MASTER_PLAN`:
- multimodal/media;
- automação social;
- voz/TTS;
- capabilities experimentais permitidas pelo hardware/contrato.

Regra de transição: nenhuma capability MW5 deve herdar autoridade só por estar listada como effect/source em um Agent.
