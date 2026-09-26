# Status

Atualizado em: 2026-09-24

## Estado atual

- Estratégia operacional: **CLOUD-FIRST**.
- GitHub: fonte de verdade e ambiente canônico de desenvolvimento/CI/checkpoints.
- PR #32 / branch `arena/01a0c8ba-tupiniquim-ai-dev-studio`: RC1 Windows **DRAFT / NÃO MERGEADO / WINDOWS-DEFERRED**.
- PR #33 / `cloud/master-wave-2-foundation`: fundação cloud-first **CLOUD-GREEN / DRAFT / NÃO MERGEADO**.
- PR #36 / `cloud/mw2-research-knowledge-registries`: MW2 **CLOUD-GREEN / DRAFT / NÃO MERGEADO**.
- PR #39 / `cloud/mw3-dev-studio-hardening-dogfood`: MW3 **CLOUD-GREEN / CONCLUÍDA NA TRILHA CLOUD / DRAFT / NÃO MERGEADO**.
- PR #41 / `cloud/mw4-agent-registry-project-threads`: MW4 **CLOUD-GREEN / CONCLUÍDA NA TRILHA CLOUD / DRAFT / NÃO MERGEADO**; Issue #40 fechada `completed`.
- PR #43 / `cloud/mw5-multimodal-automation-voice`: MW5 **CLOUD-GREEN FUNCIONAL / DRAFT / NÃO MERGEADO**; fechamento formal depende do HEAD documental final.
- `package:win` chegou a PASS no Windows físico, mas RC1 completa não foi declarada `RELEASE-GREEN`.
- Cloudflare preview + MW0–MW5 passam dry-run; MW2–MW4 estão `WAVE_STATE=CLOUD_GREEN` e MW5 será promovida no checkpoint documental final; `RELEASE_STATE` permanece `WINDOWS_DEFERRED`.
- Supabase dedicado permanece sem DDL remoto implícito pelas MW2–MW5.
- Google Drive: upload completo recebido e organizado como acervo/snapshot; GitHub continua fonte de verdade.

## Estados formais

- `CLOUD-GREEN`: gates cloud compatíveis passam no GitHub Actions.
- `WINDOWS-DEFERRED`: certificação/hardware Windows real permanece pendente quando aplicável.
- `NOT_CONFIGURED`: provider/service externa ainda não recebeu configuração explícita.
- `RELEASE-GREEN`: cloud + certificações obrigatórias de release comprovadas.

## Master Waves

- MW0: CONCLUÍDA.
- MW1: desenvolvimento cloud consolidado; RC1 física `WINDOWS-DEFERRED`.
- MW2: **CLOUD-GREEN / CONCLUÍDA NA TRILHA CLOUD**.
- MW3: **CLOUD-GREEN / CONCLUÍDA NA TRILHA CLOUD**.
- MW4: **CLOUD-GREEN / CONCLUÍDA NA TRILHA CLOUD**.
- MW5: **CLOUD-GREEN FUNCIONAL / CHECKPOINT DOCUMENTAL FINAL**.

## Master Wave 5 — entregas

- contratos strict de sources, operations, intents, decisions, provenance e voice consent;
- `Mw5CapabilityRuntime` provider-neutral e fail-closed;
- Open-Generative-AI registrado como capability source do Illustrator sem seleção automática de provider/model;
- Gemini `/reveal`, `/teardown`, `/explodedview` preservados como aliases internos, com `officialGeminiCommand=false`;
- Pocket TTS registrado como source local; execução real continua `WINDOWS_DEFERRED` quando não reproduzível em CI;
- voice cloning exige consentimento ativo no mesmo projeto + provenance da amostra;
- OpenReply permanece `NOT_CONFIGURED` até setup explícito e external write exige API oficial + network + Policy + approval;
- `kimi-k3-in-c` permanece experimental/research-only;
- `asset:create`, `asset:edit` e `network:external-write` são mapeados para capabilities canônicas, mas a camada MW5 nunca concede execução direta;
- `runtimeExecutionAuthorized=false` é invariável; materialização continua em ApprovalStore/PlanApprovalService + AuditLog;
- `Mw5CapabilityJsonStore` persiste provenance/consent atomicamente no data root e preserva isolamento após restart;
- security negatives e dogfood MW5 cobrem consentimento, provenance, API oficial, FULL_ACCESS, experimental source e restart.

## Evidência MW5 funcional

HEAD funcional: `1db71a96e80b2bd1dfce693a78bfcfa605f3eb18`.

Cloud Quality Gate run `36042725979`: **PASS**
- lint PASS;
- typecheck PASS;
- unit — 34 arquivos / 265 testes;
- integration — 15 arquivos / 104 testes; 4 skips explícitos de ambiente/live;
- security — 8 arquivos / 55 testes;
- dogfood — 3 arquivos / 13 testes (MW3 A–K + MW4 + MW5);
- build PASS;
- Cloudflare preview + MW0–MW5 dry-runs PASS.

Documentos MW5:
- `.agent/MW5_EXECUTION_PLAN.md`
- `.agent/MW5_SOURCE_REVIEW.md`
- `.agent/MW5_TEST_RESULTS.md`
- `.agent/MW5_HANDOFF.md`

## Google Drive

O upload bruto foi classificado sem tornar Drive fonte de verdade:
- source snapshot preservado em `07_ARCHIVE/2026-09-24_REPO_SOURCE_SNAPSHOT`;
- `.env*` segregados em `EXCLUDED_SENSITIVE` sem leitura;
- `node_modules`/`.cache` em `EXCLUDED_GENERATED`;
- `test-results`/`playwright-report` em `03_EVIDENCE`;
- `out`/`release` em `04_BUILDS_RELEASES`;
- itens que o conector recusou mover permanecem exceções explícitas no inbox, sem tentativa de bypass.

## Segurança / autoridade

- `agent != provider != model != tool != skill != source_repository`;
- source registrada != adotada != configurada != aprovada != executada;
- nenhum Agent/Registry/Skill/Tool/MCP/source concede runtime authority por existência;
- FULL_ACCESS não remove ApprovalStore/PlanApprovalService;
- nenhum secret real ou DDL Supabase MW5 foi introduzido;
- hardware/OAuth/provider externo real não recebe PASS por inferência.

## Pendências após MW5

- certificar RC1 Windows física para eventual `RELEASE-GREEN`;
- configurar/testar serviços externos somente por fluxo explícito quando desejado;
- Issue #37 de sincronização autenticada skills.sh permanece independente;
- integração/merge dos PRs empilhados requer decisão explícita.

## Próximo passo

1. Validar o HEAD documental final MW5 no Cloud Quality Gate.
2. Fechar Issue #42 como `completed` somente após GREEN.
3. Manter PR #43 DRAFT/não mergeado.
4. Com MW5 concluída, considerar a sequência cloud Master Waves 0–5 encerrada; qualquer nova wave exige novo planejamento/versionamento explícito.
