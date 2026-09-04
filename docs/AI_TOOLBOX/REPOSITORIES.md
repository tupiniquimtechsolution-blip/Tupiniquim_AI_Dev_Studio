# Tupiniquim AI Toolbox — Repositórios de Referência e Agentes

Atualizado em 2026-09-04.

Este catálogo registra as fontes externas aprovadas para o ecossistema Tupiniquim. Repositório externo não vira automaticamente uma dependência do core: ele pode atuar como **source repository**, **skill**, **adapter**, **module provider**, **agent template** ou **runtime experimental**.

A autoridade operacional continua no Tupiniquim: PolicyEngine, ApprovalStore, AuditLog, isolamento por projeto e contratos tipados.

## Fontes fornecidas pelo usuário

| Repositório | Licença observada | Agente/papel principal | Modo de integração | Política |
|---|---|---|---|---|
| Panniantong/Agent-Reach | MIT | Researcher / Internet Reach | skill + referência | Pesquisa e coleta; respeitar autenticação, ToS, privacidade e prompt-injection boundary |
| nextlevelbuilder/ui-ux-pro-max-skill | MIT | UI/UX Designer | skill/advisor | Direção UI/UX e QA visual; sem acesso privilegiado por padrão |
| Anil-matcha/Open-Generative-AI | MIT | Illustrator / Media Agent | module/provider source | Fonte principal de imagem/vídeo/lipsync/workflow; local-first quando viável; APIs pagas desligadas até aprovação |
| diwenne/openreply | MIT | Social Automation Agent | adapter/reference | Instagram por API oficial Meta, webhooks, rate limiting e logs redigidos |
| kyutai-labs/pocket-tts | permissiva no pacote fornecido | Voice/TTS Agent | local module/runtime | TTS local/CPU/streaming; clonagem de voz somente com consentimento |
| FareedKhan-dev/kimi-k3-in-c | Apache-2.0 | Local Model Researcher | experimental reference/runtime | Não usar como runtime padrão; avaliar checkpoint, storage, latência e hardware |
| HKUDS/CLI-Anything | Apache-2.0 | Tool / CLI Integrator | CLI hub + adapter patterns | Toda execução passa por PolicyEngine, allowlist, executable+args e E2E |
| nidhinjs/prompt-master | MIT | Prompt Architect | skill | Geração/adaptação de prompts; não substitui análise técnica |
| Shubhamsaboo/awesome-llm-apps | Apache-2.0 | Agent Pattern Library | templates/reference/skills | Biblioteca principal para agentes, multiagentes, RAG, generative UI, MCP e voice patterns |

## Awesome LLM Apps — uso no Agent Registry

O repositório é uma biblioteca, não um único agente. Exemplos mapeados:

| Família/padrão | Destino Tupiniquim |
|---|---|
| `agent_skills/advisor-orchestrator-worker` | Master Planner / Orchestrator |
| `advanced_ai_agents/multi_agent_apps/agent_teams` | Team Engine |
| `multi_agent_researcher` | Research Team |
| `multi_agent_trust_layer` e `trust_gated_agent_team` | Trust/QA Gate |
| `advanced_ai_agents/single_agent_apps/ai_system_architect_r1` | Software/System Architect |
| `ai_consultant_agent` | Consultant |
| `ai_customer_support_agent` | Customer Support |
| `ai_email_gtm_reachout_agent` / `ai_email_gtm_outreach_agent` | GTM/Outreach |
| `ai_journalist_agent` | Content/Journalist |
| `ai_meeting_agent` | Meeting Agent |
| `ai_codebase_migration_agent` | Migration Engineer |
| `generative_ui_agents/ai-knowledge-explorer` | Knowledge Explorer |
| `rag_tutorials/knowledge_graph_rag_citations` | Knowledge Graph/RAG |
| `rag_tutorials/hybrid_search_rag` | Hybrid Retrieval |
| `mcp_ai_agents/github_mcp_agent` | GitHub Tool Pattern |
| `mcp_ai_agents/browser_mcp_agent` | Browser Tool Pattern |
| `voice_ai_agents/customer_support_voice_agent` | Voice Support Pattern |

Esses padrões são candidatos à implementação. Nenhum deve contornar contratos internos ou ser copiado integralmente sem análise.

## Open Generative AI — papel do Illustrador

O `AGENT-ILLUSTRATOR` usa Open Generative AI como fonte principal para:

- Image Studio;
- Video Studio;
- Lip Sync Studio;
- Workflow Studio;
- Cinema controls;
- upload/history;
- integração local `sd.cpp` quando compatível;
- integrações externas opcionais por providers configuráveis.

O produto Tupiniquim **não herda** qualquer política externa de ausência de filtros. Geração de mídia continua sujeita às políticas e controles do próprio sistema.

## Skills

O catálogo de skills é definido em `docs/AI_TOOLBOX/SKILLS_SH_TOP500.md`.

Política:
- Top 500 All-Time = biblioteca principal por popularidade;
- Top 500 Trending = watchlist;
- `vercel-labs/skills/find-skills` = pinned;
- metadata primeiro, execução apenas após Skill Gate;
- skills são atribuídas por projeto/equipe/agente, não carregadas globalmente no contexto.

## Repositório de segurança já catalogado

| Repositório | Papel | Uso |
|---|---|---|
| usestrix/strix | Security/Pentest reference | Somente em sistemas próprios ou com autorização explícita, preferencialmente staging/CI |

## Regras de adoção

1. Verificar README, licença, versão/ref, dependências e riscos.
2. Não executar scripts externos automaticamente.
3. Preferir adapter modular, feature flag e rollback.
4. Não copiar secrets, cookies, tokens, sessões ou `.env*`.
5. Registrar source URL/ref e adaptação em issue/PR.
6. Código ou skill externa recebe trust `UNTRUSTED` até passar pelo gate.
7. Toda mutação continua condicionada ao PolicyEngine e a aprovações.
8. Serviços pagos e credenciais ficam `NOT_CONFIGURED` por padrão.
9. Projetos possuem memória, equipe e Skill Loadout isolados.
10. O backup bruto dos repositórios pode ser atualizado por `scripts/sync-ai-toolbox.ps1`.

Veja também:
- `docs/AI_TOOLBOX/AGENT_ECOSYSTEM.md`
- `.agent/AGENT_REGISTRY.json`
- `docs/AI_TOOLBOX/SKILLS_SH_TOP500.md`
