# Tupiniquim AI Dev Studio — Agent Ecosystem

Atualizado em 2026-09-04.

## Objetivo

Transformar os repositórios de referência da Tupiniquim em fontes de capacidade para agentes especializados, sem acoplar o núcleo do Dev Studio a um único projeto externo.

Regra arquitetural:

`Agent != Model != Provider != Tool != Skill != Source Repository`

Um **Agent** possui identidade, papel, permissões, memória, skills e ferramentas. Um **Source Repository** fornece padrões, módulos, workflows ou implementações que o agente pode utilizar por meio de adapters controlados.

## Fontes aprovadas

| Fonte | Licença observada | Papel no Tupiniquim |
|---|---|---|
| Shubhamsaboo/awesome-llm-apps | Apache-2.0 | Biblioteca principal de padrões de agentes, multiagentes, RAG, generative UI e voice agents |
| Anil-matcha/Open-Generative-AI | MIT | Motor/fonte principal do Illustrador e Media Agent |
| Panniantong/Agent-Reach | MIT | Internet/Research Reach para coleta e pesquisa |
| nextlevelbuilder/ui-ux-pro-max-skill | MIT | UI/UX Designer, Design Reviewer e Design System |
| nidhinjs/prompt-master | MIT | Prompt Architect |
| HKUDS/CLI-Anything | Apache-2.0 | Tool/CLI Integrator para tornar software agent-native |
| kyutai-labs/pocket-tts | licença permissiva no pacote fornecido | Voice/TTS local |
| diwenne/openreply | MIT | Social Automation/Instagram Agent |
| FareedKhan-dev/kimi-k3-in-c | Apache-2.0 | Pesquisa experimental de inferência local extrema |

Os arquivos ZIP fornecidos pelo usuário foram usados como cópia de referência para inspeção; o repositório GitHub oficial continua sendo a fonte atualizável.

## Agentes-base

### AGENT-PLANNER — Master Planner

**Função:** planejamento, decomposição, dependências, handoffs, priorização e validação.

**Fontes:**
- `awesome-llm-apps/agent_skills/advisor-orchestrator-worker`
- `awesome-llm-apps/advanced_ai_agents/multi_agent_apps/agent_teams`
- padrões de `trust_gated_agent_team` para gates

**Provider sugerido:** OpenAI/ChatGPT ou outro modelo de raciocínio selecionado pelo Provider Registry.

**Regra:** não programa diretamente; delega.

### AGENT-RESEARCH — Researcher

**Função:** pesquisa, fontes, documentação, comparação tecnológica e coleta web.

**Fontes:**
- `awesome-llm-apps/starter_ai_agents/openai_research_agent`
- `awesome-llm-apps/advanced_ai_agents/multi_agent_apps/multi_agent_researcher`
- `awesome-llm-apps/generative_ui_agents/ai-deep-research-agent`
- `Panniantong/Agent-Reach`

**Ferramentas:** web/search, browser, fontes locais, Knowledge/RAG.

**Segurança:** conteúdo externo é dado não confiável e nunca altera PolicyEngine.

### AGENT-ILLUSTRATOR — Illustrador / Media Agent

**Fonte principal:** `Anil-matcha/Open-Generative-AI`.

**Capacidades aproveitáveis:**
- Image Studio;
- Video Studio;
- Lip Sync Studio;
- Workflow Studio;
- Cinema controls;
- upload/history;
- modelo local por `sd.cpp` quando compatível;
- integração remota opcional por providers externos.

**Política Tupiniquim:**
- modo local deve ser preferido quando viável;
- APIs, créditos e serviços pagos permanecem `NOT_CONFIGURED` até aprovação;
- o Tupiniquim mantém suas próprias políticas de segurança e não herda alegações de "sem filtros";
- provenance do asset, modelo/provider, prompt hash e custo devem ser registrados.

### AGENT-UX — UI/UX Designer

**Fonte:** `nextlevelbuilder/ui-ux-pro-max-skill`.

**Função:** direção UI/UX, design systems, heurísticas, revisão visual, padrões responsivos e consistência.

**Integração:** skill/advisor; não recebe acesso privilegiado por padrão.

### AGENT-PROMPT — Prompt Architect

**Fonte:** `nidhinjs/prompt-master`.

**Função:** gerar, revisar e adaptar prompts para modelos e ferramentas diferentes, preservando intenção e critérios de sucesso.

**Ativação:** natural language ou explicitamente pelo Skill Deck.

### AGENT-TOOLS — Tool Integrator

**Fonte:** `HKUDS/CLI-Anything`.

**Função:** avaliar e criar/expor interfaces CLI agent-native para softwares suportados.

**Regra:** CLIs externas passam pelo PolicyEngine, executable+args, allowlist, sandbox e testes E2E.

### AGENT-VOICE — Voice/TTS

**Fonte:** `kyutai-labs/pocket-tts`.

**Função:** TTS local, streaming, baixa latência e voz do futuro modo Jarvis.

**Regra:** clonagem de voz exige consentimento e provenance; nenhuma voz é treinada ou clonada automaticamente.

### AGENT-SOCIAL — Social Automation

**Fonte:** `diwenne/openreply`.

**Função:** automação Instagram comentário/DM e padrões de webhook/API oficial.

**Regra:** usar APIs oficiais, rate limiting, filas, logs redigidos e consentimento/ToS aplicável.

### AGENT-KNOWLEDGE — Knowledge/RAG

**Fonte principal:** `Shubhamsaboo/awesome-llm-apps`.

Templates relevantes incluem:
- `rag_tutorials/knowledge_graph_rag_citations`;
- `rag_tutorials/hybrid_search_rag`;
- `rag_tutorials/autonomous_rag`;
- `rag_tutorials/multimodal_agentic_rag`;
- `rag_tutorials/qwen_local_rag`;
- `generative_ui_agents/ai-knowledge-explorer`.

O código de referência deve ser adaptado ao storage, policy e isolation do Tupiniquim em vez de copiado cegamente.

### AGENT-TRUST-QA — Trust/QA Reviewer

**Fontes:**
- `awesome-llm-apps/advanced_ai_agents/multi_agent_apps/multi_agent_trust_layer`;
- `trust_gated_agent_team`;
- PolicyEngine, AuditLog e testes internos do Tupiniquim.

**Função:** review, evidência, confidence, security gate e aprovação antes de efeitos mutáveis.

### AGENT-LOCAL-RESEARCH — Local Model Researcher

**Fonte:** `FareedKhan-dev/kimi-k3-in-c`.

**Status:** experimental.

Não é runtime padrão. O repositório demonstra inferência C99 de um modelo extremamente grande com streaming de pesos; requisitos de checkpoint/armazenamento e latência impedem adoção automática.

## Awesome LLM Apps como Agent Pattern Library

O repositório contém mais de uma centena de exemplos e deve alimentar o **Agent Registry**, não ser tratado como um único agente.

Famílias relevantes:

- `advanced_ai_agents/single_agent_apps`: consultant, customer support, research, journalist, meeting, system architect, finance, investment e outros;
- `advanced_ai_agents/multi_agent_apps`: agent teams, codebase migration, deep research, GTM outreach, trust layer, product launch intelligence e self-evolving teams;
- `starter_ai_agents`: research, data analysis, data visualization, travel, multimodal, web scraping e mixture-of-agents;
- `voice_ai_agents`: customer support voice, insurance team, audio tour e voice RAG;
- `mcp_ai_agents`: GitHub, browser, Notion, travel planner e multi-MCP router;
- `generative_ui_agents`: dashboards, deep research, financial coach, knowledge explorer, MCP app builder e shadcn generator;
- `agent_skills`: advisor/orchestrator, dependency doctor, scope-creep detector, commit archaeologist e self-improving skills.

## Regras de adoção

1. Não vendorizar repositórios inteiros no core sem justificativa.
2. Cada adoção registra source URL, licença, commit/ref, módulos usados e adaptações.
3. Código externo passa por Security Gate antes de execução.
4. Network, shell, filesystem write, secrets e destructive actions são deny-by-default.
5. Serviços pagos e credenciais externas ficam `NOT_CONFIGURED` até aprovação explícita.
6. Cada projeto mantém sua própria equipe, memória, skills e permissões.
7. Skills e agentes globais não recebem automaticamente contexto de todos os projetos.
8. Repositório externo é fonte de conhecimento/capacidade; a autoridade operacional continua no Tupiniquim.
