# Master Wave 2 — Execution Plan

Issue canônica: #35
Branch: `cloud/mw2-research-knowledge-registries`
Base: `cloud/master-wave-2-foundation` (`CLOUD-GREEN`)

## Objetivo

Materializar Research, Knowledge, Technology/Tool/MCP/Skill Registries sem antecipar o Agent Registry Runtime da Master Wave 4.

Princípio operacional obrigatório:

`DESCOBERTA != VERDADE != ADOÇÃO != EXECUÇÃO`

GitHub continua fonte de verdade. Google Drive recebe inputs/evidências/artefatos. Cloudflare é control-plane/preview. Supabase é platform candidate explícito por projeto e não recebe schema implicitamente.

## Baseline já existente

- contratos `ResearchSource`, `ResearchResult`, `TechnologyResolution`;
- `HttpResearchProvider` com cache, robots, SSRF/network guards e sinais de prompt injection;
- IPC `research.search`, `research.collect`, `technology.resolve`;
- `TechnologyResolutionEngine` com catálogo local/puro;
- catálogos documentais em `docs/AI_TOOLBOX/`.

Esses componentes são candidatos válidos, mas ainda não constituem aceite MW2 completo.

## Slices

### MW2.0 — Registry contracts e isolamento

Entregas:
- contratos Zod provider-neutral para entries e lifecycle;
- escopo `GLOBAL` ou `PROJECT` explícito;
- provenance, license, cost, dependencies, permissions e citations;
- Skill Gate puro, sem executar skills;
- testes de isolamento por projeto e separação descoberta/aprovação/execução.

Gate:
- lint/typecheck/unit/integration/security/build verdes;
- nenhuma regressão nos contracts existentes.

### MW2.1 — Research Agent

Entregas:
- orquestração sobre o adapter existente;
- provenance/citations obrigatórias;
- conteúdo externo permanece `EXTERNAL_UNTRUSTED`;
- nenhuma instrução coletada vira autoridade do sistema;
- cache e limites auditáveis.

### MW2.2 — Knowledge/RAG Registry

Entregas:
- registro isolado por `projectId`;
- chunks/documentos referenciam source/provenance;
- respostas/knowledge packs citation-first;
- testes A→B→A comprovam ausência de vazamento entre projetos;
- persistência escolhida só após contrato e threat model; Supabase não é adoção automática.

### MW2.3 — Technology / Tool / MCP / Public API registries

Entregas:
- Technology Registry evolui o resolver atual sem rankings globais opacos;
- Tool/MCP entries registram capabilities e permissões declaradas;
- Public APIs é catálogo de descoberta, nunca allowlist automática;
- referências educacionais/compose permanecem fontes, não dependências de runtime.

### MW2.4 — Skill Registry + Skill Gate

Entregas:
- Top 500 All-Time/Trending e `find-skills` tratados como sources versionadas/pinned;
- metadata de UI UX Pro Max, Emil Skills e Taste Skill sob demanda;
- gate exige license, cost, dependencies, permissions, provenance e aprovação;
- aprovação de registry não concede autoridade de runtime; execução futura continua sujeita a PolicyEngine/ApprovalStore.

### MW2.5 — Integração e fechamento

Entregas:
- CI completo;
- security review do diff;
- Cloudflare dry-run `mw2`;
- Supabase Readiness somente se secrets/decisão de uso estiverem presentes; sem `db push` implícito;
- `.agent/STATUS.md`, `TEST_RESULTS`, handoff e Issue #35 atualizados;
- Drive `MW2_Research_Knowledge_Registries/{00_INPUTS..04_HANDOFF}` referenciado nos handoffs.

## Definition of Done — MW2 CLOUD-GREEN

1. Contracts/registries são provider-neutral e validados em runtime.
2. Isolamento por projeto tem testes positivos e negativos.
3. Research e Knowledge preservam provenance/citations.
4. Conteúdo externo não pode elevar privilégios nem virar instrução confiável.
5. Public API, Tool, MCP e Skill descobertos não são automaticamente adotados.
6. Skill Gate impede adoção quando metadados obrigatórios estão ausentes/incertos.
7. Nenhum registry concede autorização de execução; PolicyEngine continua autoridade futura.
8. Nenhum secret é persistido/versionado.
9. GitHub Actions cloud compatível fica GREEN.
10. Requisitos Windows não exercitáveis em nuvem permanecem `WINDOWS-DEFERRED`.
