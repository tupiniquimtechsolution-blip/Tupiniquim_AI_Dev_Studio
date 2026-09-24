# Master Wave 5 — Test Results

Data: 2026-09-24
Branch: `cloud/mw5-multimodal-automation-voice`
PR: #43
Issue: #42
Functional HEAD: `1db71a96e80b2bd1dfce693a78bfcfa605f3eb18`
Cloud Quality Gate: `36042725979`

## Resultado

**CLOUD-GREEN FUNCIONAL**.

### Gates

- install: PASS
- lint: PASS
- typecheck: PASS
- unit: **34 arquivos / 265 testes PASS**
- integration: **15 arquivos PASS / 104 testes PASS / 4 skips explícitos de ambiente/live**
- security: **8 arquivos / 55 testes PASS**
- dogfood: **3 arquivos / 13 testes PASS**
  - MW3 A–K: 11
  - MW4 Agent Studio: 1
  - MW5 multimodal/voice/social: 1
- build: PASS
- Cloudflare preview dry-run: PASS
- Cloudflare MW0–MW5 dry-runs: PASS
- evidence/cleanup: PASS

O artifact step não persistiu pacote adicional porque os paths opcionais de artifact ficaram vazios. O run e seus steps permanecem a evidência operacional.

## Provas MW5

### Media / Illustrator
- Open-Generative-AI é capability source, não provider automático.
- `IMAGE_GENERATE`, `IMAGE_EDIT` e `VIDEO_GENERATE` entram como intents validados.
- `/reveal`, `/teardown` e `/explodedview` continuam aliases internos; `officialGeminiCommand=false` é preservado.
- generation/edit retorna somente decisão de proposta; `runtimeExecutionAuthorized=false`.
- image edit exige input provenance.

### Voice / Pocket TTS
- source default no gate cloud: `WINDOWS_DEFERRED`.
- TTS/voice contracts são provider-neutral.
- voice cloning exige consentimento ativo no mesmo projeto + input provenance.
- consentimento cross-project é rejeitado.
- mesmo com Policy permitindo, execução continua proposal-only.

### Social / OpenReply
- source default: `NOT_CONFIGURED`.
- somente configuração explícita pode promovê-la a READY no control-plane.
- external write exige API oficial confirmada e `requiresNetwork=true`.
- FULL_ACCESS não concede execução direta; approval continua obrigatório.
- nenhum scraping/browser automation foi introduzido.

### Experimental
- `kimi-k3-in-c` permanece `EXPERIMENTAL` e é negado pelo gate.

### Persistência / isolamento
- provenance e voice consent persistem atomicamente em `<dataRoot>/mw5-runtime/state.json`.
- restart recupera estado.
- list/read são escopados por projeto.
- consentimento de A não autoriza B.

## Diff / security review

Base: MW4 final `91bff884e16e02d7e68151e8d1af57e679478e63`.
Functional HEAD: `1db71a96e80b2bd1dfce693a78bfcfa605f3eb18`.

Review: 14 arquivos alterados/adicionados, limitados a MW5 contracts/runtime/store/audit/tests/CI/docs.

Não encontrado:
- secret versionado;
- DDL/migration Supabase;
- chamada real a MuAPI/Gemini/Pocket TTS/Meta/OpenReply;
- provider/model embutido no Agent como autoridade;
- bypass de PolicyEngine;
- `runtimeExecutionAuthorized=true`;
- bypass de ApprovalStore/PlanApprovalService/AuditLog;
- promoção de Kimi experimental para runtime.

## Deferências legítimas

Continuam fora da prova cloud:
- execução física Pocket TTS/voice em hardware local;
- geração local real por sd.cpp/Wan2GP/Open-Generative-AI;
- credenciais/integração humana Meta/OpenReply;
- qualquer provider pago/externo não configurado;
- Electron/ConPTY/package Windows e demais gates físicos RC1.

Esses itens permanecem `WINDOWS_DEFERRED` ou `NOT_CONFIGURED`, nunca PASS implícito.
