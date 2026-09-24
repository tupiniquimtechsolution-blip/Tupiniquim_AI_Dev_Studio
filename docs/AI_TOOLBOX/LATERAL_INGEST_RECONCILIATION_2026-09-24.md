# Reconciliação de Ingestões Laterais — 2026-09-24

Issue: #45
Release branch: `release/post-master-waves-integration`

## Objetivo

Preservar conhecimento útil dos PRs laterais #13, #30 e #31 sem substituir silenciosamente contratos, registries ou planos que evoluíram nas Master Waves.

## Regra de leitura

Os arquivos datados de 2026-09-18 e `GOOGLE_SKILLS.md` são **snapshots de provenance/knowledge**. Quando mencionam Wave 17, MW2 futura ou outro estado temporal antigo, essa frase descreve o estado no momento da ingestão e **não** redefine o estado atual do projeto.

Estado atual de release/integration continua em:
- `.agent/RELEASE_INTEGRATION_STATUS.md`;
- `docs/RELEASE/POST_MASTER_WAVES_RELEASE_INTEGRATION_PLAN.md`;
- `.agent/MASTER_PLAN.md`.

## PR #13 — google/skills

Classificação: `PORT_SELECTED`.

Portado:
- `docs/AI_TOOLBOX/GOOGLE_SKILLS.md` como snapshot documental first-party;
- `google/skills` no catálogo reconciliado;
- backup opcional em `scripts/sync-ai-toolbox.ps1`.

Não portado:
- versões antigas de `.agent/MASTER_PLAN.md`, `.agent/AGENT_REGISTRY.json`, `AGENTS.md` e shims de skill, pois foram substituídas por contratos/registries das MW2–MW5;
- alterações de runtime/provider implícitas: nenhuma.

## PR #30 — knowledge import 2026-09-18

Classificação: `PORT_SELECTED + PARTIALLY_SUPERSEDED`.

Portado como provenance:
- `KNOWLEDGE_IMPORT_2026-09-18.md`;
- `generated/knowledge-import-2026-09-18.json`.

Esses arquivos preservam padrões que não estavam todos presentes no pack posterior, incluindo local-admin loopback/Host/Origin, provider lifecycle/leases, sandbox lifecycle e MCP schema refresh.

Não portado:
- a versão antiga do `SECURITY_BASELINE.md`, porque #31 contém uma evolução compatível;
- a versão antiga de `REPOSITORIES.md`, consolidada neste release;
- a versão antiga da skill canônica, substituída pela skill/Composer atuais.

## PR #31 — external sources, security, media e 3D

Classificação: `PORT_SELECTED`.

Portado:
- `EXTERNAL_SOURCE_AND_SECRET_GATE.md`;
- `KNOWLEDGE_PACK_2026-09-18.json`;
- `KNOWLEDGE_PACK_MEDIA_2026-09-18.json`;
- `MEDIA_AND_3D_REFERENCES_2026-09-18.md`;
- baseline de segurança multi-agent;
- `scripts/sync-ai-toolbox-extra-sources.ps1`.

Guardrails preservados:
- nenhum valor de segredo é armazenado ou testado;
- `framepipe-dev/media-inference-worker` permanece security case, não source sincronizável;
- Higgsfield permanece opcional/networked/cost-gated;
- WorldClaw permanece research reference;
- sources externas não ganham runtime authority.

## Resultado

A reconciliação lateral adiciona somente conhecimento, políticas e scripts explícitos de backup/sync. Não altera AIProvider, Agent Runtime, PolicyEngine, ApprovalStore, PlanApprovalService, AuditLog, Supabase DDL ou autorização de execução da MW5.
