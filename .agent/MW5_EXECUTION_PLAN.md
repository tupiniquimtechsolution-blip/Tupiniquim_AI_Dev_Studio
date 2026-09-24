# Master Wave 5 — Execution Plan

Data: 2026-09-24
Branch: `cloud/mw5-multimodal-automation-voice`
Issue: #42
PR: #43
Base: MW4 final HEAD `91bff884e16e02d7e68151e8d1af57e679478e63`
Functional HEAD auditado: `1db71a96e80b2bd1dfce693a78bfcfa605f3eb18`
Functional CI: `36042725979` — GREEN

## Objetivo

Consolidar multimodal, automação social e voz como capabilities provider-neutral, auditáveis e isoladas por projeto, sem transformar source registry, Agent metadata, preset ou provider externo em autoridade de execução.

## Invariantes

1. `agent != provider != model != tool != skill != source_repository`.
2. Provider/model continuam seleção explícita fora do Agent.
3. `asset:create`, `asset:edit` e `network:external-write` nunca recebem autoridade pela presença no Agent Registry.
4. Todo efeito mutável MW5 passa por mapping canônico + PolicyEngine e termina `runtimeExecutionAuthorized=false` nesta camada.
5. Materialização real continua condicionada a ApprovalStore/PlanApprovalService + AuditLog.
6. Provenance de assets é obrigatória quando aplicável.
7. Voice cloning exige consentimento explícito, ativo, escopado ao projeto + provenance da amostra.
8. Social external write exige API oficial confirmada, source configurada e approval; scraping/browser automation não é autorizado.
9. Sources pagas/credenciadas permanecem `NOT_CONFIGURED` até setup explícito.
10. Runtime local/hardware não reproduzível no CI permanece `WINDOWS_DEFERRED`.
11. `kimi-k3-in-c` permanece pesquisa experimental sem runtime.
12. Nenhum secret, DDL Supabase ou merge automático pertence à MW5.

## Slices concluídos

### MW5.0 — Baseline, contratos e source review — CONCLUÍDO
- review versionado de Open-Generative-AI, Pocket TTS, OpenReply e kimi-k3-in-c;
- contracts strict para sources, intents, decisions, provenance e consent;
- source catalog provider-neutral/fail-closed.

### MW5.1 — Media / Illustrator control-plane — CONCLUÍDO
- Open-Generative-AI como capability source do Illustrator;
- provider/model permanecem externos ao Agent;
- geração/edição são proposals e nunca efeitos diretos.

### MW5.2 — Gemini presets + provenance — CONCLUÍDO
- `/reveal`, `/teardown`, `/explodedview` preservados como aliases internos;
- `officialGeminiCommand=false` preservado;
- provenance records strict e persistentes;
- image edit exige input provenance.

### MW5.3 — Voice / TTS — CONCLUÍDO NO CONTROL-PLANE CLOUD
- Pocket TTS registrado como source local;
- default cloud state `WINDOWS_DEFERRED`;
- voice clone exige consentimento ativo + input provenance;
- nenhuma clonagem real é executada pelo control-plane.

### MW5.4 — Social Automation — CONCLUÍDO NO CONTROL-PLANE CLOUD
- OpenReply registrado como source social oficial-API-only;
- default `NOT_CONFIGURED`;
- external write exige source READY, API oficial confirmada e network declarado;
- nenhuma credencial Meta ou envio real é criado pela MW5.

### MW5.5 — Persistência / restart / audit / security — CONCLUÍDO
- `<dataRoot>/mw5-runtime/state.json` com writes atômicos;
- provenance/consent isolados por projeto;
- restart comprovado;
- AuditLog adapter;
- negativos para provenance, consent, cross-project, API oficial, network, FULL_ACCESS e experimental source.

### MW5.6 — Dogfood / fechamento — FUNCIONALMENTE CONCLUÍDO
- dogfood MW5 Registry→Project→preset/provenance→voice consent→social gate→restart;
- lint/typecheck/unit/integration/security/dogfood/build GREEN;
- Cloudflare preview + MW0–MW5 dry-runs GREEN;
- diff/security review concluído;
- STATUS/MASTER_PLAN/TEST_RESULTS/HANDOFF preparados;
- falta somente o GREEN do HEAD documental final para fechar Issue #42.

## Critério CLOUD-GREEN

Functional gate já comprovado no run `36042725979`.

A MW5 fecha formalmente somente após o checkpoint documental final repetir todos os gates GREEN. `CLOUD-GREEN` continua sem equivaler a `RELEASE-GREEN`.
