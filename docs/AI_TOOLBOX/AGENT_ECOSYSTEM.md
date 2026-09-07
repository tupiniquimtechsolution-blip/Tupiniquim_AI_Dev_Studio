# Tupiniquim AI Dev Studio — Agent Ecosystem

Atualizado em 2026-09-04.

## Regra central

`Agent != Model != Provider != Tool != Skill != Source Repository`.

O Dev Studio é multi-LLM. Um agente tem papel, capacidades, permissões e loadout; o modelo/provider é selecionado separadamente e permanece sob controle do usuário. Repositórios externos fornecem padrões e capacidades, nunca autoridade operacional.

## Camadas

1. **Contrato universal** — `AGENTS.md` e `.agents/skills/tupiniquim-toolbox/SKILL.md`.
2. **Agent Registry** — `.agent/AGENT_REGISTRY.json`.
3. **Capability sources** — repositórios, skills, providers e referências auditadas.
4. **Policy layer** — PolicyEngine, ApprovalStore, AuditLog, isolamento por projeto e redaction.
5. **Runtime** — só entra na Wave correspondente do Plano Mestre.

## Fontes de agentes/capacidades

- Awesome LLM Apps → biblioteca de padrões para Planner, Research, RAG, Trust/QA e equipes.
- Open Generative AI → principal fonte de arquitetura/capacidade do Illustrator / Media Agent.
- Agent Reach → pesquisa e alcance web/social.
- UI UX Pro Max → UI/UX, design system e revisão visual.
- Emil Kowalski Skills → design engineering, motion, animation review e UI polish.
- Taste Skill → anti-slop para landing pages, portfólios e redesigns; não usar como padrão para dashboards/data-heavy UI.
- Prompt Master → engenharia de prompts.
- CLI-Anything → integração agent-native via CLI.
- Pocket TTS → voz/TTS local.
- OpenReply → automação social por APIs oficiais.
- Strix → pentest/remediação somente em alvos próprios/autorizados.
- Vibe Coding Toolkit → **Engineering Playbook Source**, não runtime: brainstorm→plan, orquestração de subagentes, revisão multiagente, quality gates e memória.
- Google Skills → **First-Party Skill Source** para Google Cloud, Gemini, Agent Platform, Google Ads, Analytics, Firebase e demais produtos Google; resolução sob demanda via `finding-google-skills`.

## Google skill routing

Para pedidos relacionados a produtos Google, consultar primeiro `google/skills:skills/developers/finding-google-skills` quando a skill específica ainda não estiver carregada.

Prioridades atuais:
- Gemini API / multimodal / function calling → `skills/cloud/gemini-api`;
- voz e streaming bidirecional → `skills/cloud/gemini-live-api`;
- Skill Registry Google → `skills/cloud/agent-platform-skill-registry`;
- segurança multiagente Google Cloud → `skills/cloud/google-cloud-solution-multi-agent-security`;
- Google Ads MCP → `skills/ads/google-ads-api-mcp-setup`.

A fonte é oficial, mas qualquer shell, rede, credencial, OAuth, instalação ou mudança de infraestrutura continua subordinada às políticas Tupiniquim. A escolha de modelo/provider continua sob controle do usuário.

## Design routing

Não carregar as três fontes de design ao mesmo tempo por padrão.

- Sistema/heurísticas/consistência → UI UX Pro Max.
- Motion, microinterações, animação e design engineering → `emilkowalski/skills`.
- Landing page, portfólio, página editorial ou redesign anti-template → `Leonxlnx/taste-skill`.
- Dashboard, admin, tabelas ou fluxo de produto denso → evitar Taste Skill salvo instrução explícita; priorizar design system/acessibilidade.

## Reference Libraries identificadas no vídeo Dev Arthur

Estas fontes alimentam Research/Knowledge/Technology Resolver; não são agentes e não entram automaticamente no contexto:

- `EbookFoundation/free-programming-books` — fonte canônica de livros/recursos gratuitos.
- `public-apis/public-apis` — catálogo de APIs; qualquer API descoberta ainda exige validação de ToS, auth, custo e segurança.
- `docker/awesome-compose` — padrões oficiais de Docker Compose.
- `TheAlgorithms/Python` — representante ativo do ecossistema TheAlgorithms para algoritmos/estruturas; selecionar outro idioma quando o projeto exigir.
- `jwasham/coding-interview-university` — currículo/referência de fundamentos de CS; não é dependência de produção.
- `supabase/supabase` — platform source opcional; só integrar a um projeto quando houver decisão arquitetural explícita.

### Links corrigidos/descartados

- `aluismoya/EbookFoundation-free-programming-books` não é a fonte canônica atual; usar `EbookFoundation/free-programming-books`.
- `TheAlgorithms/TheAlgorithms.github.io` está arquivado/depreciado; não usar como fonte principal.
- `GabrielCee27/coding-interview-university`, `kevingo/coding-interview-university-zh-tw` e `tlapinsk/coding-interview-university` são cópias/derivações/localizações; registrar somente quando uma tradução específica for necessária.

## Gemini video presets

O vídeo enviado mostrou `/reveal`, `/teardown` e `/explodedview`. No Tupiniquim eles são **aliases internos de prompt**, não “comandos secretos oficiais do Gemini”.

Implementação:
- catálogo/documentação em `docs/AI_TOOLBOX/GEMINI_VIDEO_PRESETS.md`;
- resolver puro em `packages/core/src/gemini-video-presets.ts`;
- nenhum acesso de rede ou credencial;
- provider Gemini real continua sujeito ao AIProvider/MediaProvider e à Wave adequada.

## Ordem do Plano Mestre

Esta integração não muda a Wave atual.

- Wave 1: concluir runtime local/propostas/browser QA.
- Wave 2: Research, Knowledge, Technology/Tool/MCP/Skill Registries + catálogos de referência + `google/skills` como First-Party Skill Source.
- Wave 3: hardening/dogfood + adoção seletiva de engineering playbooks/quality gates.
- Wave 4: Agent Registry runtime e equipes por projeto.
- Wave 5: multimodal/voz/social, incluindo Media Agent e provider Gemini quando aprovado.

## Gate de adoção

Antes de ativar fonte externa: origem/licença/ref → dependências → threat review → custo → permissões → compatibilidade → testes → PolicyEngine/AuditLog → aprovação → versão/hash → ativação.
