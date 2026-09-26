# Master Wave 5 — Handoff

Data: 2026-09-24
Branch: `cloud/mw5-multimodal-automation-voice`
PR: #43 — DRAFT / NÃO MERGEADO
Issue: #42
Base: MW4 final `91bff884e16e02d7e68151e8d1af57e679478e63`
Functional HEAD: `1db71a96e80b2bd1dfce693a78bfcfa605f3eb18`
Functional CI: `36042725979` — GREEN

## Estado entregue

A Master Wave 5 está funcionalmente `CLOUD-GREEN` para o control-plane multimodal, voz e automação social.

### Contratos
- `mw5SourceDefinitionSchema`
- `mw5CapabilityIntentSchema`
- `mw5CapabilityDecisionSchema`
- `mw5AssetProvenanceSchema`
- `mw5VoiceConsentSchema`

Todos são strict/fail-closed.

### Sources
- `OPEN_GENERATIVE_AI`: capability source Media/Illustrator; nenhum provider automático.
- `GEMINI_VIDEO_PRESETS`: aliases internos de prompt; não comandos oficiais.
- `POCKET_TTS`: source local de TTS/voice; runtime real permanece dependente do ambiente local.
- `OPENREPLY`: source de social automation via API oficial; permanece não configurada até setup explícito.
- `KIMI_K3_C`: experimental/research-only.

### Autoridade

Nenhuma source, Agent, preset ou provider-state concede execução.

Fluxo obrigatório:
`Agent/project approval → MW5 intent → source/effect checks → consent/provenance/API checks → PolicyEngine → requiresApproval → ApprovalStore/PlanApprovalService → AuditLog → materializador específico futuro/aprovado`.

A camada MW5 termina sempre com `runtimeExecutionAuthorized=false`.

### Persistência

`Mw5CapabilityJsonStore` usa `<dataRoot>/mw5-runtime/state.json`, escrita atômica e leitura escopada por projeto.

### Segurança comprovada
- input provenance obrigatório para edit/clone quando aplicável;
- voice clone sem consentimento é negado;
- consentimento não cruza projetos;
- external write sem API oficial é negado;
- external write que omite network é negado;
- FULL_ACCESS não elimina approval;
- source experimental não executa;
- nenhuma credencial externa é criada/versionada.

## Fontes revisadas

Ver `.agent/MW5_SOURCE_REVIEW.md`.

Adoção permanece separada de descoberta/registro/configuração/aprovação/execução.

## Gate funcional

Run `36042725979`:
- lint/typecheck PASS;
- unit 265 PASS;
- integration 104 PASS / 4 skips explícitos;
- security 55 PASS;
- dogfood 13 PASS;
- build PASS;
- Cloudflare preview + MW0–MW5 PASS.

## Limites

`CLOUD-GREEN` não é `RELEASE-GREEN`.

Continuam independentes:
- RC1 Windows física;
- Electron/ConPTY/package Windows;
- local inference/TTS/hardware real;
- OAuth/Meta credentials e validação humana;
- providers pagos ou externos ainda não configurados.

## Integração

PR #43 permanece DRAFT e não deve ser mergeado automaticamente. O checkpoint documental final precisa repetir GREEN antes de fechar a Issue #42.

Como a sequência operacional versionada define Master Waves 0–5, a conclusão da MW5 encerra a sequência cloud planejada atual. Próximos ciclos devem nascer de novo planejamento/versionamento, não de uma “MW6” implícita.
