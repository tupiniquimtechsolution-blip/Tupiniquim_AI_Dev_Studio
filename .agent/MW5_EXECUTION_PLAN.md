# Master Wave 5 — Execution Plan

Data: 2026-09-24
Branch: `cloud/mw5-multimodal-automation-voice`
Issue: #42
Base: MW4 final HEAD `91bff884e16e02d7e68151e8d1af57e679478e63`

## Objetivo

Consolidar multimodal, automação social e voz como capabilities provider-neutral, auditáveis e isoladas por projeto, sem transformar source registry, Agent metadata, preset ou provider externo em autoridade de execução.

## Invariantes

1. `agent != provider != model != tool != skill != source_repository`.
2. Provider/model continuam seleção explícita fora do Agent.
3. `asset:create`, `asset:edit` e `network:external-write` são efeitos mutáveis e nunca recebem autoridade pela presença no Agent Registry.
4. Todo efeito mutável da MW5 passa por mapping canônico + PolicyEngine e continua `runtimeExecutionAuthorized=false` nesta camada.
5. Materialização real continua condicionada a ApprovalStore/PlanApprovalService + AuditLog.
6. Provenance de assets é obrigatória para outputs registrados.
7. Voice cloning exige consentimento explícito, ativo e escopado ao projeto, além de provenance da amostra.
8. Social external write exige API oficial confirmada, source configurada e approval; scraping/browser automation não é autorizado.
9. Sources pagos ou dependentes de credenciais permanecem `NOT_CONFIGURED` até configuração explícita.
10. Runtime local/hardware não reproduzível no CI permanece `WINDOWS_DEFERRED`, nunca PASS fictício.
11. `kimi-k3-in-c` permanece pesquisa experimental e não entra no runtime executável.
12. Nenhum secret, DDL Supabase ou merge automático faz parte da MW5.

## Slices

### MW5.0 — Baseline, contratos e source review

- registrar review verificável de Open-Generative-AI, Pocket TTS, OpenReply e kimi-k3-in-c;
- contracts strict para sources, intents, decisions, provenance e voice consent;
- source catalog provider-neutral/fail-closed.

### MW5.1 — Media / Illustrator control-plane

- Open-Generative-AI como principal capability source do `AGENT-ILLUSTRATOR`;
- Gemini presets internos permanecem aliases de prompt, não comandos oficiais;
- provider/model ficam externos ao Agent e nunca são inferidos automaticamente;
- asset creation/edit proposals exigem provenance.

### MW5.2 — Voice / TTS

- Pocket TTS registrado como source local de TTS/voice;
- cloud CI comprova contrato/gates; execução local real fica `WINDOWS_DEFERRED` quando não reproduzível;
- voice cloning exige consentimento + provenance da amostra;
- nenhum clone é executado por esta camada.

### MW5.3 — Social Automation

- OpenReply registrado como source de comment-to-DM via API oficial;
- source permanece `NOT_CONFIGURED` sem integração explícita;
- `network:external-write` exige API oficial, network=true, PolicyEngine e Approval;
- nenhuma credencial Meta é criada/versionada pela MW5.

### MW5.4 — Persistência / restart / isolamento

- provenance e consent records persistem sob data root;
- leitura é filtrada por projeto;
- restart preserva estado sem cross-project leakage;
- writes atômicos; nenhuma migration Supabase.

### MW5.5 — Audit / security

- audit events para consent, provenance e capability gate;
- negativos: source spoofing, Agent sem source/effect, voice clone sem consent, provenance ausente, social sem API oficial, source não configurada, cross-project consent, experimental source.

### MW5.6 — Dogfood / fechamento

- dogfood real Registry → Project → Media preset/provenance → Voice consent → Social gate → restart;
- lint/typecheck/unit/integration/security/dogfood/build;
- Cloudflare preview + MW0–MW5 dry-runs;
- diff/security review;
- STATUS/MASTER_PLAN/MW5_TEST_RESULTS/MW5_HANDOFF;
- Issue #42 só fecha após o HEAD documental final repetir GREEN.

## Critério CLOUD-GREEN

A MW5 só fecha quando os contratos e control-plane multimodal/voice/social estiverem comprovados por CI, sem qualquer bypass de Policy/Approval/Audit, e toda capacidade dependente de hardware/credencial externa permanecer explicitamente deferida ou não configurada.

`CLOUD-GREEN` não equivale a `RELEASE-GREEN`.
