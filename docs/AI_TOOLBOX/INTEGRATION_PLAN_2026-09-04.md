# Integration Plan — Multi-LLM Agent Ecosystem + Skills + Reference Libraries

Data: 2026-09-04.

## Estado

Esta integração é **documental/registry + utilitários puros**. Ela não antecipa o runtime do Agent Registry nem adiciona provider pago/rede.

## Wave 1 — não alterar prioridade

Concluir o que já está em `.agent/STATUS.md`: origem de propostas no protocolo de ferramentas, provenance e browser QA. Os novos catálogos não podem desviar essa sequência.

## Wave 2 — Research / Knowledge / Technology / Tool / Skill

Entram:
- Agent Reach e padrões de Research do Awesome LLM Apps;
- RAG/Knowledge patterns;
- Public APIs como catálogo de descoberta;
- Free Programming Books, TheAlgorithms e Coding Interview University como referências;
- Docker Awesome Compose como biblioteca de padrões de ambiente;
- Skill Registry Top 500 + `find-skills`;
- Skill Gate;
- design-skill metadata (UI UX Pro Max, Emil Skills, Taste Skill);
- Supabase somente como capability/platform candidate por projeto.

## Wave 3 — Dev Studio hardening

Avaliar seletivamente práticas do `soumatheusgomes/vibe-coding-toolkit`:
- brainstorm→plan;
- subagent waves sem colisão;
- multi-agent code review;
- lint/quality gates;
- memória/handoff.

Não importar regras mecanicamente. Exemplo: limite fixo de 350 linhas é referência, não requisito universal.

## Wave 4 — Agent Registry Runtime

Transformar `.agent/AGENT_REGISTRY.json` em contratos Zod/runtime, com provider/model escolhidos separadamente e efeitos submetidos ao PolicyEngine. Não usar booleano simples de “pode mutar” como autorização.

## Wave 5 — Multimodal / automação / voz

- Illustrator / Media Agent com Open Generative AI como capability source;
- Gemini video presets como aliases de prompt;
- Gemini/MediaProvider real somente após contrato/provider aprovado;
- Pocket TTS;
- OpenReply;
- demais integrações multimodais.

## Skills de design

Registrar agora, carregar sob demanda:
- `emilkowalski/skills:emil-design-eng`;
- `Leonxlnx/taste-skill:design-taste-frontend`.

A referência antiga mostrada no vídeo `emilkowalski/design-skills` não é o repositório atual; o upstream vigente é `emilkowalski/skills`.

## Definition of Done desta integração

- fontes corrigidas e classificadas;
- registry provider-neutral;
- backups apontam para repositórios canônicos;
- aliases Gemini implementados e testáveis sem rede;
- Multi-LLM continua fonte de verdade;
- nenhuma dependência externa ou provider ativado automaticamente;
- CI verde.
