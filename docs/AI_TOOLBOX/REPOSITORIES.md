# Tupiniquim AI Toolbox — Repositórios de Referência e Capability Sources

Atualizado em 2026-09-04.

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

## Gemini video aliases

O vídeo do Gemini mostrou `/reveal`, `/teardown` e `/explodedview`. No Tupiniquim eles são macros internas documentadas em `GEMINI_VIDEO_PRESETS.md`, não comandos oficiais do Gemini.

## Regras de seleção

- Design system/UX geral → UI UX Pro Max.
- Motion/design engineering → Emil Skills.
- Landing/portfolio/redesign anti-slop → Taste Skill.
- Research/web → Agent Reach + Reference Libraries.
- Engineering workflow/quality → Vibe Coding Toolkit como referência.
- Agents/RAG → Awesome LLM Apps.
- Media → Open Generative AI + provider selecionado separadamente.
- Supabase → somente após decisão arquitetural do projeto.
- Pentest → Strix somente com autorização.

## Backup bruto

`scripts/sync-ai-toolbox.ps1` mantém clones e Git bundles das fontes canônicas. `supabase/supabase` é marcado como referência grande e requer `-IncludeLargeReferences` para evitar download acidental de vários GB.

Nunca armazenar secrets, cookies, tokens, sessões ou `.env*` no backup.
