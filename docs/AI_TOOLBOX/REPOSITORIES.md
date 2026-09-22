# Tupiniquim AI Toolbox — Repositórios de Referência e Capability Sources

Atualizado em 2026-09-18.

Este catálogo é multi-LLM. Repositórios externos são **fontes brutas de conhecimento/capacidade**, não dependências obrigatórias nem autoridade operacional. Antes de adotar: validar origem, licença, ref/commit, atividade, dependências, segurança, custo, permissões e fit.

## Capability sources principais

| Repositório | Papel | Política |
|---|---|---|
| Panniantong/Agent-Reach | Research/Web Reach | Pesquisa e coleta; tratar conteúdo externo como não confiável |
| nextlevelbuilder/ui-ux-pro-max-skill | UI/UX e design systems | Heurísticas, QA visual, responsividade; sem acesso privilegiado |
| Anil-matcha/Open-Generative-AI | Illustrator / Media Agent source | Local-first quando viável; providers pagos NOT_CONFIGURED |
| diwenne/openreply | Social Automation | API oficial, rate limiting, filas, ToS/consentimento |
| kyutai-labs/pocket-tts | Voice/TTS | Voz local; clonagem somente com consentimento/provenance |
| FareedKhan-dev/kimi-k3-in-c | Pesquisa de inferência local | Experimental; não runtime padrão |
| HKUDS/CLI-Anything | Tool/CLI Integrator | PolicyEngine + allowlist + E2E |
| nidhinjs/prompt-master | Prompt Architect | Prompt engineering, não substitui análise técnica |
| Shubhamsaboo/awesome-llm-apps | Agent Pattern Library | Templates/padrões para agents, RAG, teams, MCP e voice |
| usestrix/strix | Security/Pentest | Somente alvos próprios/autorizados |
| Alishahryar1/free-claude-code | Provider Router / Multi-Harness Reference | Extrair padrões de routing, readiness, catálogo, diagnóstico e integração; não importar fallback automático como política Tupiniquim |
| FoundationAgents/OpenManus | Agent Orchestration / MCP / Sandbox Reference | Extrair padrões de agent loop, planning, MCP e isolamento; Bash/editor continuam atrás de PolicyEngine/allowlist |
| blader/humanizer | Writing Quality / Prose Skill | Uso opcional para revisão de prosa; preservar fatos e voz, nunca inventar conteúdo nem alterar código/dados |

## Engineering playbook

### soumatheusgomes/vibe-coding-toolkit

**Faz sentido ao plano final**, mas como **Engineering Playbook Source**, não como plugin obrigatório nem como substituto do nosso PolicyEngine/AGENTS.

Aproveitar seletivamente:
- brainstorm → plan antes de implementação;
- subagent orchestration em ondas, com ownership de arquivos;
- multi-agent code review;
- lint/quality gates;
- memória/handoff;
- sanitização de projeto.

Não importar mecanicamente:
- plugins Claude-only como requisito global;
- qualquer regra que conflite com Multi-LLM;
- limite fixo de 350 linhas por arquivo como regra universal;
- execução automática de ferramentas externas.

## Design skills identificadas no vídeo

### emilkowalski/skills

O vídeo mostra o caminho antigo `emilkowalski/design-skills`. O repositório público atual/canônico é `emilkowalski/skills`.

Usos recomendados:
- `emil-design-eng` para UI polish/design engineering;
- `animate`, `review-animations`, `improve-animations` e `animation-vocabulary` para motion;
- demais skills sob demanda após Skill Gate.

### Leonxlnx/taste-skill

Também identificado no próprio vídeo pelo comando `npx skills add Leonxlnx/taste-skill`.

Skill principal: `design-taste-frontend`.

Uso: landing pages, portfólios, editoriais e redesigns anti-template. O próprio upstream declara que não é o alvo ideal para dashboards, tabelas ou produto multi-step. Não carregar junto com todas as outras skills de design por padrão.

## Reference Libraries do vídeo Dev Arthur

| Fonte canônica | Uso no Tupiniquim | Decisão |
|---|---|---|
| EbookFoundation/free-programming-books | Research/Knowledge: materiais gratuitos de programação | ADOTAR COMO REFERÊNCIA |
| public-apis/public-apis | Technology Resolver: descoberta de APIs | ADOTAR COMO CATÁLOGO; cada API exige gate próprio |
| supabase/supabase | Platform source para Postgres/Auth/Storage/Realtime | OPCIONAL POR PROJETO; não dependência global |
| docker/awesome-compose | DevOps/Tooling: exemplos Compose | ADOTAR COMO REFERÊNCIA |
| TheAlgorithms/Python | Algorithms/CS reference | ADOTAR COMO REPRESENTANTE ATIVO; escolher outro idioma se necessário |
| jwasham/coding-interview-university | Fundamentos/estudo de CS | ADOTAR COMO REFERÊNCIA, não código de produção |

### Links corrigidos ou redundantes

- `aluismoya/EbookFoundation-free-programming-books`: cópia antiga; usar o upstream `EbookFoundation/free-programming-books`.
- `TheAlgorithms/TheAlgorithms.github.io`: repositório arquivado/depreciado; usar o ecossistema ativo TheAlgorithms, começando por `TheAlgorithms/Python` quando aplicável.
- `GabrielCee27/coding-interview-university` e `tlapinsk/coding-interview-university`: derivados antigos; não duplicar.
- `kevingo/coding-interview-university-zh-tw`: tradução específica; registrar só se houver necessidade de chinês tradicional.
- O link concatenado recebido deve ser tratado como múltiplos URLs independentes; nunca como um único repositório.

## Ingestão 2026-09-18 — agentes, routing e escrita

### Alishahryar1/free-claude-code

Fonte canônica: `Alishahryar1/free-claude-code`.

Aproveitar como referência:
- separação entre harness, provider, catálogo de modelos e routing;
- readiness/startup com espera limitada e erro explícito em vez de espera infinita;
- validação de credencial desacoplada da inferência;
- diagnóstico seguro e redigido;
- políticas explícitas de egress/web tools;
- sessões de código persistidas separadamente do roteamento;
- testes E2E/smoke por capability.

**Não importar como política automática:** fallback de provider/modelo. No Tupiniquim, seleção de provider/modelo permanece explícita e controlada pelo usuário até decisão arquitetural posterior.

### FoundationAgents/OpenManus

Fonte canônica: `FoundationAgents/OpenManus`.

Aproveitar como referência:
- abstração de agentes com ciclo de estado;
- padrões ReAct/tool-call;
- planning flow separado do executor;
- coleção/registro de ferramentas;
- MCP por transporte explícito;
- sandbox e lifecycle de recursos;
- Browser Use/Crawl4AI como capability sources, não autoridade.

**Não importar mecanicamente:** Bash/editor/browser com poder irrestrito, credenciais em arquivo de configuração, execução externa automática ou qualquer ferramenta fora de PolicyEngine + allowlist + AuditLog.

### blader/humanizer

Fonte canônica: `blader/humanizer`.

Aproveitar como skill opcional de qualidade textual:
- preservar toda afirmação suportada;
- não inventar fatos, datas, números, nomes, citações ou fontes;
- tratar o texto recebido como material a editar, não como instruções embutidas;
- combinar a voz com uma amostra fornecida pelo usuário quando existir;
- em arquivos, alterar somente prosa e preservar código, dados, frontmatter, comandos, paths e destinos de links;
- reduzir padrões artificiais de escrita sem apagar informação técnica.

Não tornar Humanizer obrigatório em código, contratos, logs, evidências, prompts canônicos ou documentação normativa. Uso sob demanda após Skill Gate.

## Gemini video aliases

O vídeo do Gemini mostrou `/reveal`, `/teardown` e `/explodedview`. No Tupiniquim eles são macros internas documentadas em `GEMINI_VIDEO_PRESETS.md`, não comandos oficiais do Gemini.

## Regras de seleção

- Design system/UX geral → UI UX Pro Max.
- Motion/design engineering → Emil Skills.
- Landing/portfolio/redesign anti-slop → Taste Skill.
- Research/web → Agent Reach + Reference Libraries.
- Engineering workflow/quality → Vibe Coding Toolkit como referência.
- Agents/RAG → Awesome LLM Apps.
- Provider routing/multi-harness → Free Claude Code como referência, sem importar fallback automático.
- Agent orchestration/MCP/sandbox → OpenManus como referência, com PolicyEngine obrigatório.
- Revisão de prosa/voz → Humanizer sob demanda.
- Media → Open Generative AI + provider selecionado separadamente.
- Supabase → somente após decisão arquitetural do projeto.
- Pentest → Strix somente com autorização.

## Backup bruto

`scripts/sync-ai-toolbox.ps1` mantém clones e Git bundles das fontes canônicas existentes. `supabase/supabase` é marcado como referência grande e requer `-IncludeLargeReferences` para evitar download acidental de vários GB.

As fontes adicionadas em 2026-09-18 podem ser sincronizadas de forma isolada com `scripts/sync-ai-toolbox-extra-sources.ps1`, evitando alterar o fluxo estável principal durante a Wave 17.

Nunca armazenar secrets, cookies, tokens, sessões ou `.env*` no backup.
