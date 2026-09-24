# Plano Mestre Operacional

## Autoridade e estado reconciliado

Este plano operacionaliza o Prompt Mestre de 2026-08-17. Git, código e testes prevalecem sobre documentação histórica. A implementação preservada em `66f94a7` misturava entregas antecipadas; ela foi consolidada gradualmente sem descartar componentes válidos.

Desde 2026-09-24, o desenvolvimento adota operação **cloud-first**. GitHub é a fonte de verdade e ambiente canônico de desenvolvimento/CI. `F:\CODEX\Tupiniquim-AI-Dev-Studio` permanece raiz de certificação Windows física/local, não do ciclo diário cloud.

Estados:
- `CLOUD-GREEN`: gates cloud compatíveis passam no GitHub Actions.
- `WINDOWS-DEFERRED`: requisitos Windows/hardware reais seguem pendentes quando aplicável.
- `NOT_CONFIGURED`: integração/provider externa ainda não recebeu setup explícito.
- `RELEASE-GREEN`: cloud + certificações obrigatórias de release comprovadas.

## Waves

| Wave Mestre | Escopo | Estado |
|---:|---|---|
| 0 | Fundação confiável: isolamento local, AIProvider, persistência, IPC/PolicyEngine, E2E e redaction | CONCLUÍDA |
| 1 | Dev AI local autônomo: runtime local, agente, workspace, memória, contexto e browser QA | cloud consolidado / RC1 física `WINDOWS-DEFERRED`; PR #32 aberto |
| 2 | Research, Knowledge, Technology/Tool/MCP/Skill Registries | **CLOUD-GREEN / CONCLUÍDA**; PR #36 + Issue #35 |
| 3 | Dev Studio completo, hardening e dogfood controlado | **CLOUD-GREEN / CONCLUÍDA**; PR #39 + Issue #38 |
| 4 | Tupiniquim AI Studio: Agent Registry e Agents → Projects/Threads | **CLOUD-GREEN / CONCLUÍDA**; PR #41 + Issue #40 |
| 5 | Multimodal, automação e voz, conforme hardware | **CLOUD-GREEN FUNCIONAL / CHECKPOINT DOCUMENTAL FINAL**; PR #43 + Issue #42 |

## Política de avanço cloud-first

1. Uma Master Wave avança quando sua antecessora está `CLOUD-GREEN` no escopo cloud compatível.
2. Capacidades não reproduzíveis em nuvem ficam `WINDOWS-DEFERRED`, nunca PASS fictício.
3. Electron packaging, ConPTY, Ollama/local inference, TTS/hardware e OAuth humanos permanecem gates de release quando aplicáveis.
4. Cloudflare hospeda control-plane/preview e não substitui runtime Windows.
5. Supabase continua platform source opcional por projeto; nenhuma adoção global ou DDL implícito.
6. Google Drive recebe cópias/acervo/evidências e nunca substitui GitHub como fonte de verdade.
7. PR #32 permanece DRAFT/não mergeado até decisão baseada em evidência própria da RC1 Windows.
8. Um Agent nunca é autoridade: role/capabilities/effects não substituem PolicyEngine, ApprovalStore/PlanApprovalService ou AuditLog.
9. Descoberta/registro de source != adoção != configuração != aprovação != execução.

## Mapeamento de legado

- Antiga Wave 4 = Wave Mestre 0.
- Plan/Approval/Execute, Research/Resolver, Prompt, Visual, Preferences e Preview do WIP foram reconciliados nas waves correspondentes.
- Provider/model permanecem separados dos Agents e devem ser selecionados explicitamente.

## Extensões consolidadas

### Wave 2
- Research Agent usando padrões do Awesome LLM Apps + Agent Reach.
- Knowledge/RAG Registry com isolamento por projeto e citations.
- Public APIs como descoberta, nunca allowlist automática.
- Free Programming Books, TheAlgorithms e Coding Interview University como referências.
- Docker Awesome Compose como padrões de ambiente.
- Skill Registry com snapshots/metadata e `find-skills` pinned.
- Skill Gate com licença, custo, dependências, permissões, provenance e aprovação.
- Supabase registrado como platform candidate, sem adoção global implícita.

### Wave 3
- Vibe Coding Toolkit como Engineering Playbook Source não autoritativa.
- hardening, redaction, negative security tests e dogfood A–K.
- requisitos cloud separados de Windows/hardware.

### Wave 4
- `.agent/AGENT_REGISTRY.json` materializado em Zod strict/runtime fail-closed.
- provider/model externos ao Agent e explícitos em dispatch/thread.
- assignment/loadout/team/memory namespace isolados por projeto.
- thread binding bloqueia reuse cross-project/cross-agent/provider e exige rebind para troca de model.
- effects passam por mapping canônico + PolicyEngine e continuam dependentes de ApprovalStore/PlanApprovalService + AuditLog.
- state durável no data root com restart comprovado.

### Wave 5
- Open-Generative-AI consolidado como capability source do Illustrator/Media Agent, sem provider automático.
- Gemini video presets `/reveal`, `/teardown`, `/explodedview` permanecem aliases internos, não comandos oficiais.
- Pocket TTS registrado como source local de TTS/voice; execução real pode permanecer `WINDOWS_DEFERRED`.
- voice cloning exige consentimento explícito ativo no mesmo projeto + provenance da amostra.
- OpenReply registrado como source social; external write exige source configurada + API oficial + network + Policy + approval.
- `kimi-k3-in-c` permanece pesquisa experimental sem runtime authority.
- provenance/consent persistem sob data root e são isolados por projeto.
- toda decision MW5 mantém `runtimeExecutionAuthorized=false`.

## Gate final da Master Wave 1 — Wave 17

A Wave 17 continua gate de dogfood/QA da RC1 Windows. A trilha cloud não a apaga nem a transforma em `RELEASE-GREEN`.

## Gate final da Master Wave 2

A MW2 é `CLOUD-GREEN` quando registries/contracts são provider-neutral, isolamento/provenance/trust/Skill Gate passam, nenhum registry concede runtime authority, nenhum secret/DDL é introduzido e os quality gates ficam GREEN.

Evidência: `.agent/MW2_TEST_RESULTS.md` e `.agent/MW2_HANDOFF.md`.

## Gate final da Master Wave 3

A MW3 é `CLOUD-GREEN` quando readiness separa cloud/deferências, dogfood A–K e security negatives passam, redaction/absolute blocks permanecem, referências externas não ganham autoridade e lint/typecheck/unit/integration/security/dogfood/build/Cloudflare ficam GREEN.

Evidência funcional: run `36020705177`, HEAD `2a9be68cf17c6ac65101b499fd940b76acbd6e73`.
Checkpoint documental: run `36021301533`, HEAD `b1ddba47d907847003fa3fd3e1f07796da850703`.

## Gate final da Master Wave 4

A MW4 é `CLOUD-GREEN` quando Agent Registry é strict/fail-closed; provider/model não viram autoridade; project/team/thread/memory ficam isolados; effects passam por mapping+Policy; `runtimeExecutionAuthorized=false`; persistência/restart e negativos passam; dogfood Registry→Project→Team→Thread→Dispatch→Gate→restart passa; nenhum secret/DDL/runtime MW5 é introduzido; quality gates ficam GREEN.

Evidência funcional: run `36025944421`, HEAD `0b1a64efe6f55ab890f2d30d5156b362f0f936aa`.
Checkpoint documental final: run `36026521736`, HEAD `91bff884e16e02d7e68151e8d1af57e679478e63`.

## Gate final da Master Wave 5

A MW5 é `CLOUD-GREEN` quando:
1. sources/operations/intents/decisions/provenance/consent usam contratos strict/fail-closed;
2. Open-Generative-AI é capability source, não provider/model automático;
3. Gemini presets permanecem aliases internos com `officialGeminiCommand=false`;
4. asset generation/edit nunca executa diretamente a partir do Agent/source registry;
5. edit/clone exigem provenance quando aplicável;
6. voice cloning exige consentimento ativo no mesmo projeto;
7. Pocket TTS local não recebe PASS de hardware no CI cloud; runtime real permanece `WINDOWS_DEFERRED` quando aplicável;
8. OpenReply external write exige configuração explícita, API oficial e network declarado;
9. FULL_ACCESS não elimina ApprovalStore/PlanApprovalService;
10. `kimi-k3-in-c` permanece experimental/research-only;
11. provenance/consent persistem atomicamente e sobrevivem restart sem cross-project leakage;
12. AuditLog recebe eventos MW5;
13. nenhum secret, provider credential ou DDL Supabase é introduzido;
14. unit/integration/security/dogfood provam os negativos e o fluxo controlado;
15. lint, typecheck, unit, integration, security, dogfood, build e Cloudflare preview/MW0–MW5 ficam GREEN;
16. diff review não encontra chamada real a provider externo nem bypass de Policy/Approval/Audit.

Evidência funcional: Cloud Quality Gate run `36042725979`, HEAD `1db71a96e80b2bd1dfce693a78bfcfa605f3eb18`.

Documentação: `.agent/MW5_EXECUTION_PLAN.md`, `.agent/MW5_SOURCE_REVIEW.md`, `.agent/MW5_TEST_RESULTS.md`, `.agent/MW5_HANDOFF.md`.

## Conclusão da sequência cloud

A sequência Master Waves versionada neste plano é 0–5. Quando o HEAD documental final MW5 repetir GREEN e a Issue #42 for fechada como `completed`, a sequência cloud planejada atual estará concluída. Isso **não** declara `RELEASE-GREEN`: a certificação Windows/hardware/credenciais humanas continua independente.

Qualquer ciclo posterior deve nascer de novo planejamento/versionamento explícito, não de uma “MW6” implícita.

## Protocolo de execução

Para cada wave cloud-first: teste → correção → diff/security review → STATUS/TEST_RESULTS/HANDOFF → checkpoint documental → novo GREEN → fechamento.

Para release Windows: executar certificação específica e somente então promover para `RELEASE-GREEN`.
