# Status

Atualizado em: 2026-09-24

## Estado atual

- Estratégia operacional: **CLOUD-FIRST**.
- GitHub: fonte de verdade e ambiente canônico de desenvolvimento/CI/checkpoints.
- PR #32 / branch `arena/01a0c8ba-tupiniquim-ai-dev-studio`: trilha RC1 Windows, **DRAFT / NÃO MERGEADO / WINDOWS-DEFERRED**.
- PR #33 / branch `cloud/master-wave-2-foundation`: fundação cloud-first **CLOUD-GREEN / DRAFT / NÃO MERGEADO**.
- PR #36 / branch `cloud/mw2-research-knowledge-registries`: Master Wave 2 **CLOUD-GREEN / DRAFT / NÃO MERGEADO**.
- PR #39 / branch `cloud/mw3-dev-studio-hardening-dogfood`: Master Wave 3 **CLOUD-GREEN / CONCLUÍDA NA TRILHA CLOUD / DRAFT / NÃO MERGEADO**; Issue #38 fechada `completed`.
- PR #41 / branch `cloud/mw4-agent-registry-project-threads`: Master Wave 4 **CLOUD-GREEN FUNCIONAL / DRAFT / NÃO MERGEADO**; Issue #40 só fecha após o gate do HEAD documental final.
- `package:win` chegou a PASS no Windows físico após instalação das bibliotecas Spectre; RC1 completa não foi declarada RELEASE-GREEN.
- Cloudflare: preview + ambientes MW0–MW5 validados por dry-run; MW2–MW4 reconciliados como `WAVE_STATE=CLOUD_GREEN`, mantendo `RELEASE_STATE=WINDOWS_DEFERRED`.
- Supabase: projeto dedicado `Tupiniquim-AI-Dev-Studio`, ref `brqokxlmxwyxwwbtsltc`, `ACTIVE_HEALTHY`; nenhum DDL remoto aplicado por MW2/MW3/MW4.
- Google Drive: workspace MW0–MW5 preparado; uploads são acervo/inputs, nunca fonte de verdade.

## Estados formais

- `CLOUD-GREEN`: gates cloud compatíveis passam no GitHub Actions.
- `WINDOWS-DEFERRED`: certificação Windows real permanece pendente.
- `RELEASE-GREEN`: cloud + certificações obrigatórias de release comprovadas.

## Master Waves

- Master Wave 0: CONCLUÍDA.
- Master Wave 1: desenvolvimento cloud consolidado; RC1 Windows preservada como `WINDOWS-DEFERRED`.
- Master Wave 2: **CLOUD-GREEN / CONCLUÍDA NA TRILHA CLOUD**.
- Master Wave 3: **CLOUD-GREEN / CONCLUÍDA NA TRILHA CLOUD**.
- Master Wave 4: **CLOUD-GREEN FUNCIONAL / CONCLUSÃO DOCUMENTAL EM CHECKPOINT FINAL**.
- Master Wave 5: **AUTORIZADA COMO PRÓXIMA TRILHA CLOUD somente após GREEN do HEAD documental final MW4**.

## Master Wave 4 — entregas

- `.agent/AGENT_REGISTRY.json` materializado por contrato Zod strict/runtime fail-closed;
- Agent permanece separado de provider/model/tool/skill/source repository;
- provider/model continuam inputs explícitos de thread/dispatch;
- aprovação por projeto com `approvalRef`, loadouts e memory namespaces isolados;
- project teams exigem Agents aprovados no mesmo projeto;
- thread binding bloqueia reuse cross-project/cross-agent/provider e exige rebind para troca de model;
- `effects` são metadata/intenção, não autoridade;
- aliases MW4 mapeados para capabilities canônicas antes de PolicyEngine;
- toda ação mutável originada do Agent Runtime continua com `runtimeExecutionAuthorized=false` nesta camada e exige ApprovalStore/PlanApprovalService para materialização;
- effects sem materializador MW4, incluindo `asset:create`, permanecem metadata-only;
- `AgentProjectJsonStore` persiste assignments/teams/thread bindings no data root e recupera após restart;
- `AgentRuntimeAuditAdapter` integra eventos ao AuditLog existente;
- security negatives e dogfood MW4 exercitam isolamento, injection, FULL_ACCESS sem autoridade, disable e restart.

## Evidência MW4 funcional

HEAD funcional: `0b1a64efe6f55ab890f2d30d5156b362f0f936aa`.

Cloud Quality Gate run `36025944421`: **PASS**
- install
- lint
- typecheck
- unit — 33 arquivos / 259 testes
- integration — 14 arquivos / 103 testes; 4 skips explícitos de ambiente/live
- security — 7 arquivos / 48 testes
- dogfood — 2 arquivos / 12 testes (MW3 A–K + MW4 Agent Studio)
- build
- Cloudflare preview dry-run
- Cloudflare MW0–MW5 dry-runs
- evidence step

O run não gerou artifact persistido porque os paths opcionais de artifact ficaram vazios; o próprio run/steps é a evidência operacional.

Documentos MW4:
- `.agent/MW4_EXECUTION_PLAN.md`
- `.agent/MW4_TEST_RESULTS.md`
- `.agent/MW4_HANDOFF.md`

## Segurança / autoridade

- nenhum Agent recebe provider/model como propriedade de autoridade;
- nenhum Registry/Skill/Tool/MCP/Agent concede runtime mutation authority por existência ou aprovação de metadata;
- FULL_ACCESS preserva PolicyEngine/absolute blocks e não remove ApprovalStore/PlanApprovalService;
- capability não declarada falha fechado;
- effect futuro sem materializador aprovado falha fechado;
- thread/project isolation é persistente e testado após restart.

## Supabase / Drive

- nenhum secret real versionado;
- nenhuma migration/DDL MW2/MW3/MW4 aplicada remotamente;
- `.env*`, secrets/credentials/tokens, generated artifacts e VCS internals continuam fora da auto-ingestion de Knowledge;
- Drive não substitui GitHub como fonte de verdade.

## Pendências não bloqueantes

- Issue #37 — sincronização autenticada dos Top 500 skills.sh quando Vercel OIDC estiver disponível; rankings não são fabricados.
- classificação final do `01_INBOX_UPLOADS` quando o upload terminar.
- certificação Windows física independente para promover futuramente a `RELEASE-GREEN`.

## Próximo passo

1. Rodar Cloud Quality Gate do HEAD documental final MW4.
2. Fechar Issue #40 como `completed` somente após esse GREEN.
3. Manter PR #41 DRAFT/não mergeado até integração explícita.
4. Após o checkpoint, liberar Master Wave 5 na trilha cloud sem alterar o estado `WINDOWS-DEFERRED` da RC1.
