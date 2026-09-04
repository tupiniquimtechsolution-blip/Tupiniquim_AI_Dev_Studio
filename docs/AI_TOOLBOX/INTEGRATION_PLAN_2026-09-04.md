# Integration Plan — Agent Sources + Skills Top 500

Data: 2026-09-04

## Resultado esperado

O Tupiniquim deve transformar fontes externas em capacidades selecionáveis por Agent Registry, com isolamento por projeto, PolicyEngine, AuditLog e Skill Gate.

## Fase 0 — Baseline documental

Status neste branch: **IMPLEMENTED AS DOCUMENTATION/REGISTRY**.

Entregas:
- Agent Ecosystem documentado;
- Agent Registry machine-readable;
- repositórios mapeados a papéis;
- Skills.sh Top 500 policy;
- script de sincronização;
- AGENTS.md conectado aos novos registries;
- Master Plan expandido.

Esta fase não declara nenhum adapter externo como runtime concluído.

## Fase 1 — Agent Registry Runtime

Objetivo: transformar `.agent/AGENT_REGISTRY.json` em contratos/runtime internos.

Entregas:
1. schemas Zod para AgentDefinition, AgentCapabilitySource e AgentLoadout;
2. ProjectAgentAssignment;
3. estados `NOT_CONFIGURED | READY | RUNNING | WAITING_APPROVAL | BLOCKED | ERROR`;
4. provenance de source repository/ref;
5. UI read-only para listar agentes;
6. testes unit/integration;
7. nenhum agente externo recebe permissão implícita.

## Fase 2 — Research + Knowledge

Prioridade P0 da Wave Mestre 2.

Research Agent:
- padrões Awesome LLM Apps;
- Agent Reach como source/tool;
- web content marcado untrusted;
- evidências/citações;
- Technology Resolver.

Knowledge Agent:
- hybrid RAG;
- knowledge graph;
- citation-aware retrieval;
- project-scoped storage;
- sem cross-project leakage.

## Fase 3 — Illustrator / Media Agent

Fonte principal: `Anil-matcha/Open-Generative-AI`.

Primeiro incremento:
1. contrato `MediaProvider` separado de Agent;
2. image generation local-first quando disponível;
3. external providers `NOT_CONFIGURED`;
4. asset provenance;
5. prompt hash;
6. custo/provider/model registrados;
7. nenhum secret no renderer/log;
8. UI com estado explícito.

Vídeo, lipsync e cinema controls entram depois do primeiro image gate.

## Fase 4 — Specialist Agents

- UI/UX Agent → UI UX Pro Max;
- Prompt Architect → Prompt Master;
- Tool Integrator → CLI-Anything;
- Voice Agent → Pocket TTS;
- Social Agent → OpenReply;
- Local Model Research → kimi-k3-in-c experimental.

Cada um ganha adapter/gate separado e pode permanecer `NOT_CONFIGURED`.

## Fase 5 — Skills Top 500

Objetivo: Global Skill Library com 500 skills mais utilizadas e watchlist de 500 trending.

### Snapshot

`scripts/sync-skills-sh-top500.ps1 -View all-time`

gera o catálogo principal.

`scripts/sync-skills-sh-top500.ps1 -View trending`

gera a watchlist.

`find-skills` é pinned.

### Importante

A API oficial v1 do skills.sh exige Vercel OIDC. Não fabricar ranking quando a autenticação não estiver disponível. O snapshot completo deve ser gerado em ambiente autenticado e versionado com timestamp.

### Runtime

1. metadata import;
2. deduplicação por stable id;
3. audit-on-activation;
4. cost classification;
5. permission classification;
6. Project Skill Library;
7. Team/Agent Loadout;
8. natural-language resolver;
9. `find-skills` como fallback de descoberta.

## Fase 6 — Skill Deck UX

- cards;
- busca;
- Skill Wheel;
- drag & drop;
- favoritos;
- recommended loadout;
- risk/cost badges;
- guided tour;
- "Encontrar Skill".

## Fase 7 — Project Teams / Office

Somente após Agent Runtime e Skill Runtime estarem reais.

Cada projeto recebe equipe própria. A futura interface Office/Munder Difflin exibe workers reais e nunca avatares simulando execução inexistente.

## Gates obrigatórios

Antes de habilitar qualquer capability source:
- licença/fonte/ref registrados;
- threat review;
- dependencies review;
- test fixture;
- PolicyEngine coverage;
- AuditLog coverage;
- redaction;
- cancellation/error state;
- project isolation;
- rollback/disable path.

## Próxima execução recomendada para o Qwen Coder

**TASK: AGENT-RUNTIME-01 — contracts only**

Escopo:
- ler `.agent/AGENT_REGISTRY.json`;
- criar somente contratos Zod/tipos para AgentDefinition, CapabilitySource e SkillLoadout;
- zero integração de rede;
- zero instalação de repo externo;
- zero mutação de workspace por agentes;
- testes unitários;
- relatório de compatibilidade com contratos atuais.

Após evidência e revisão, liberar AGENT-RUNTIME-02.
