# Tupiniquim AI Dev Studio — Agent Ecosystem

Atualizado em 2026-09-24 — reconciliação pós-Master-Waves.

## Regra central

`Agent != Model != Provider != Tool != Skill != Source Repository`.

O Dev Studio é multi-LLM. Um agente tem papel, capacidades, permissões e loadout; modelo/provider são selecionados separadamente e permanecem sob controle do usuário. Repositórios externos fornecem padrões/capacidades, nunca autoridade operacional.

## Camadas

1. **Contrato universal** — `AGENTS.md` e `.agents/skills/tupiniquim-toolbox/SKILL.md`.
2. **Agent Registry** — `.agent/AGENT_REGISTRY.json`.
3. **Capability/Skill sources** — repositórios, skills, providers e referências auditadas.
4. **Policy layer** — PolicyEngine, ApprovalStore/PlanApprovalService, AuditLog, isolamento por projeto e redaction.
5. **Runtime** — somente materializadores aprovados; metadata/registry nunca concede execução por si só.

## Fontes de agentes/capacidades

- Awesome LLM Apps → padrões para Planner, Research, RAG, Trust/QA e equipes.
- Open Generative AI → principal source do Illustrator / Media Agent.
- Agent Reach → pesquisa e alcance web/social.
- UI UX Pro Max → UI/UX, design system e revisão visual.
- Emil Kowalski Skills → design engineering, motion e animation review.
- Taste Skill → landing/portfolio/redesign anti-template; não default para dashboards densos.
- Prompt Master → engenharia de prompts.
- CLI-Anything → integração agent-native via CLI.
- Pocket TTS → voz/TTS local.
- OpenReply → automação social por APIs oficiais.
- Strix → pentest/remediação somente em alvos próprios/autorizados.
- Vibe Coding Toolkit → Engineering Playbook Source, não runtime.
- Google Skills → **First-Party Skill Source** para Google Cloud, Gemini, Agent Platform, Google Ads e demais produtos Google, resolvida sob demanda.
- Free Claude Code → referência de provider routing/multi-harness, sem auto-fallback como política Tupiniquim.
- OpenManus → referência de agent/planning/MCP/sandbox, mantendo privileged tools atrás de policy/approval.
- Humanizer → skill opcional de revisão de prosa, sem autoridade sobre código/dados/fatos.

## Google skill routing

Para tarefas especificamente Google, consultar primeiro `google/skills:skills/developers/finding-google-skills` quando a skill adequada ainda não estiver carregada.

Referências atuais documentadas:
- Gemini API/multimodal/function calling → `skills/cloud/gemini-api`;
- streaming/voz → `skills/cloud/gemini-live-api`;
- Skill Registry Google → `skills/cloud/agent-platform-skill-registry`;
- segurança multi-agent Google Cloud → `skills/cloud/google-cloud-solution-multi-agent-security`;
- Google Ads MCP → `skills/ads/google-ads-api-mcp-setup`.

Origem first-party não remove Skill Gate, PolicyEngine, Approval, AuditLog, least privilege, custo ou consentimento. Não há prioridade automática de Gemini como provider/modelo.

## Design routing

- Sistema/heurísticas/consistência → UI UX Pro Max.
- Motion/microinterações/design engineering → `emilkowalski/skills`.
- Landing/portfolio/editorial/redesign anti-template → `Leonxlnx/taste-skill`.
- Dashboard/admin/tabelas/fluxos densos → priorizar design system/acessibilidade; Taste somente quando solicitado.

## Reference Libraries

Estas fontes alimentam Research/Knowledge/Technology Resolver e não entram automaticamente no contexto:
- `EbookFoundation/free-programming-books`;
- `public-apis/public-apis`;
- `docker/awesome-compose`;
- `TheAlgorithms/Python`;
- `jwasham/coding-interview-university`;
- `supabase/supabase` como platform source opcional por projeto.

Forks/cópias/traduções só são registradas quando há necessidade específica; upstream canônico tem preferência.

## Gemini video presets

`/reveal`, `/teardown` e `/explodedview` são **aliases internos de prompt**, não comandos oficiais secretos do Gemini.

Implementação:
- documentação em `docs/AI_TOOLBOX/GEMINI_VIDEO_PRESETS.md`;
- resolver em `packages/core/src/gemini-video-presets.ts`;
- nenhum acesso de rede/credencial por resolver alias;
- provider real continua sujeito ao contrato e gates MW5/release.

## Estado pós-Master-Waves

- MW0–MW5: concluídas na trilha cloud conforme `.agent/MASTER_PLAN.md` e handoffs correspondentes.
- Release & Integration: em andamento no PR/Issue de release; `CLOUD-GREEN` não equivale a `RELEASE-GREEN`.
- Certificações Windows/hardware/OAuth permanecem gates separados quando aplicáveis.

## Gate de adoção

Antes de ativar source externa: origem/licença/ref → dependências → threat review → custo → permissões → compatibilidade → testes → PolicyEngine/Approval/Audit → versão/hash/provenance → ativação.
