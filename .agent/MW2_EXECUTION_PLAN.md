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

## Slices — estado final

### MW2.0 — Registry contracts e isolamento — CONCLUÍDA

- contratos Zod provider-neutral para entries e lifecycle;
- escopo `GLOBAL` ou `PROJECT` explícito;
- provenance, license, cost, dependencies, permissions e citations;
- Registry/Skill Gate puro, sem executar skills/APIs/MCPs;
- testes de isolamento por projeto e separação descoberta/aprovação/execução.

### MW2.1 — Research Agent — CONCLUÍDA

- orquestração sobre o adapter existente;
- provenance/citations preservadas;
- conteúdo externo permanece `EXTERNAL_UNTRUSTED`;
- `instructionsAuthoritative=false`;
- prompt-injection signals permanecem warnings, nunca instruções.

### MW2.2 — Knowledge/RAG Registry — CONCLUÍDA

- registro/query isolados por `projectId`;
- chunks/documentos referenciam source/citation e content hash;
- testes A→B comprovam ausência de vazamento;
- policy de auto-ingestion bloqueia paths sensíveis, VCS e artefatos gerados;
- persistência remota não foi adotada implicitamente; nenhum DDL Supabase aplicado.

### MW2.3 — Technology / Tool / MCP / Public API registries — CONCLUÍDA

- Technology Resolution entra como descoberta por projeto;
- catálogo de referências modela Tool/MCP/Public API/Platform sob contrato comum;
- Public APIs continua catálogo de descoberta, nunca allowlist automática;
- referências educacionais/compose são sources, não dependências de runtime.

### MW2.4 — Skill Registry + Skill Gate — CONCLUÍDA

- snapshot validation versionado;
- `find-skills` pinned tratado como discovery metadata, não runtime autorizado;
- UI UX Pro Max, Emil Skills e Taste Skill disponíveis como metadata/loadout sob demanda;
- gate exige license, cost, dependencies, permissions, provenance e aprovação;
- aprovação de registry não concede autoridade de runtime.

### MW2.5 — Integração e fechamento — CONCLUÍDA

- Cloud Quality Gate completo GREEN;
- Skills Snapshot Validation GREEN;
- security/build/Cloudflare dry-runs GREEN;
- `.agent/STATUS.md`, `.agent/MW2_TEST_RESULTS.md` e `.agent/MW2_HANDOFF.md` atualizados;
- Drive `MW2_Research_Knowledge_Registries/{00_INPUTS..04_HANDOFF}` permanece destino de conteúdo/evidência, não fonte de verdade.

## Definition of Done — MW2 CLOUD-GREEN

1. Contracts/registries são provider-neutral e validados em runtime. PASS.
2. Isolamento por projeto tem testes positivos e negativos. PASS.
3. Research e Knowledge preservam provenance/citations. PASS.
4. Conteúdo externo não pode elevar privilégios nem virar instrução confiável. PASS.
5. Public API, Tool, MCP e Skill descobertos não são automaticamente adotados. PASS.
6. Skill Gate impede adoção quando metadados obrigatórios estão ausentes/incertos. PASS.
7. Nenhum registry concede autorização de execução. PASS.
8. Nenhum secret é persistido/versionado. PASS.
9. GitHub Actions cloud compatível fica GREEN. PASS.
10. Requisitos Windows não exercitáveis em nuvem permanecem `WINDOWS-DEFERRED`. PASS.

## Evidência

Ver `.agent/MW2_TEST_RESULTS.md`.

Estado final: **MASTER WAVE 2 CLOUD-GREEN / CONCLUÍDA NA TRILHA CLOUD**.
