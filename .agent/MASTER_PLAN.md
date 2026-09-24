# Plano Mestre Operacional

## Autoridade e estado reconciliado

Este plano operacionaliza o Prompt Mestre de 2026-08-17. Git, código e testes prevalecem sobre documentação histórica. A implementação preservada em `66f94a7` mistura entregas da antiga Wave 4 com código antecipado das Waves 5–10; ela é consolidada sem descartar componentes válidos.

Desde 2026-09-24, o desenvolvimento adota operação **cloud-first**. GitHub é a fonte de verdade e ambiente canônico de desenvolvimento/CI. `F:\CODEX\Tupiniquim-AI-Dev-Studio` permanece a raiz obrigatória para certificação Windows física/local, não para o ciclo diário de desenvolvimento.

Estados de gate:
- `CLOUD-GREEN`: gates cloud compatíveis passam no GitHub Actions.
- `WINDOWS-DEFERRED`: requisitos Windows reais seguem pendentes e não podem ser reportados como aprovados.
- `RELEASE-GREEN`: cloud + certificações obrigatórias de release estão comprovadas.

## Waves

| Wave Mestre | Escopo | Estado |
|---:|---|---|
| 0 | Fundação confiável: isolamento local, AIProvider, persistência, IPC/PolicyEngine, E2E e redaction | CONCLUÍDA; checkpoint/wave-04 |
| 1 | Dev AI local autônomo: runtime local, agente, workspace, memória, contexto e browser QA | desenvolvimento cloud consolidado / WINDOWS-DEFERRED para RC1 física; PR #32 permanece aberto |
| 2 | Research, Knowledge, Technology/Tool/MCP/Skill Registries | **CLOUD-GREEN / CONCLUÍDA NA TRILHA CLOUD**; PR #36 + Issue #35 |
| 3 | Dev Studio completo, hardening e dogfood controlado | **CLOUD-GREEN / CONCLUÍDA NA TRILHA CLOUD**; PR #39 + Issue #38 |
| 4 | Tupiniquim AI Studio: Agent Registry e Agents → Projects/Threads | **CLOUD-GREEN FUNCIONAL / CHECKPOINT DOCUMENTAL FINAL**; PR #41 + Issue #40 |
| 5 | Multimodal, automação e voz, conforme hardware | **AUTORIZADA APÓS GREEN DO HEAD DOCUMENTAL MW4** |

## Política de avanço cloud-first

1. Uma Master Wave pode avançar quando sua antecessora estiver `CLOUD-GREEN` para o escopo cloud compatível.
2. Capacidades não reproduzíveis em nuvem ficam marcadas `WINDOWS-DEFERRED`, nunca PASS fictício.
3. Electron packaging, ConPTY, Ollama local/hardware e fluxos OAuth humanos permanecem gates de release quando aplicáveis.
4. Cloudflare hospeda control-plane/preview e não substitui runtime Windows.
5. Supabase permanece platform source opcional por projeto; nenhuma adoção global implícita.
6. Google Drive pode receber cópias de evidências/builds, mas não substitui GitHub como fonte de verdade.
7. PR #32 permanece DRAFT/não mergeado até decisão baseada em evidência própria da RC1 Windows.
8. Um Agent nunca é autoridade: role/capabilities/effects no registry não substituem PolicyEngine, ApprovalStore/PlanApprovalService ou AuditLog.

## Mapeamento de legado

- Antiga Wave 4 = Wave Mestre 0.
- Plan/Approval/Execute, Research/Resolver, Prompt, Visual, Preferences e Preview presentes no WIP foram reconciliados gradualmente nas waves correspondentes; aceite só ocorre quando fronteiras, testes e integração são comprovados.
- Não será adicionado um provider local antes de estabilizar o contrato `AIProvider`.

## Extensões aprovadas sem alterar a ordem das Waves

### Wave 2

- Research Agent usando padrões do Awesome LLM Apps + Agent Reach.
- Knowledge/RAG Registry com isolamento por projeto e citations.
- Public APIs como catálogo de descoberta, nunca allowlist automática.
- Free Programming Books, TheAlgorithms e Coding Interview University como referências de aprendizagem/fundamentos.
- Docker Awesome Compose como biblioteca de padrões de ambiente.
- Skill Registry com Top 500 All-Time, Top 500 Trending e `find-skills` pinned.
- Skill Gate com licença, custo, dependências, permissões, provenance e aprovação.
- Metadados de UI UX Pro Max, Emil Skills e Taste Skill disponíveis para loadout sob demanda.
- Supabase registrado como platform candidate por projeto; nenhuma adoção global implícita.

### Wave 3

- Vibe Coding Toolkit avaliado seletivamente como Engineering Playbook Source: brainstorm→plan, subagent waves, code review e quality gates.
- Regras externas continuam referências. Limites rígidos como “350 linhas por arquivo” só viram requisito se compatíveis com a arquitetura real.
- Hardening/dogfood permanece gate antes do Agent Runtime completo.
- O detalhamento histórico original dos cenários A–K não foi localizado nas fontes canônicas versionadas. A MW3 usa uma matriz operacional A–K explicitamente reconstruída dos RF/RNF; qualquer divergência futura exige reconciliação documentada, nunca substituição silenciosa.

### Wave 4

- `.agent/AGENT_REGISTRY.json` materializado em contratos Zod strict e runtime fail-closed.
- Provider/model selecionados separadamente do Agent e vinculados explicitamente por dispatch/thread.
- Agent assignment/loadout/team/memory namespace isolados por projeto.
- Thread binding bloqueia reuse cross-project/cross-agent/provider e exige rebind explícito para mudança de model.
- Efeitos mutáveis são capabilities submetidas a mapping canônico + PolicyEngine + ApprovalStore/PlanApprovalService + AuditLog; um booleano simples não concede autoridade.
- Effects sem materializador MW4 aprovado permanecem metadata-only, inclusive effects reservados para multimodal/voz/social da MW5.
- Assignments/teams/thread bindings persistem no data root com restart comprovado.

### Wave 5

- `Anil-matcha/Open-Generative-AI` como principal capability source do Illustrator / Media Agent, sujeito ao mesmo gate de confiança/capability da MW4.
- Gemini video presets (`/reveal`, `/teardown`, `/explodedview`) como aliases internos de prompt; provider real somente após contrato aprovado.
- Pocket TTS para TTS local/voz.
- OpenReply para automação social.
- kimi-k3-in-c apenas como pesquisa experimental.
- Nenhuma fonte/effect da MW5 herda runtime authority por estar cadastrada no Agent Registry.

## Aceite da Wave 0

1. Scripts, dados, caches e testes respeitam a raiz operacional do ambiente em que estão rodando; na certificação Windows física, permanece obrigatório F:.
2. O transporte Codex stdio JSONL inicializa, autentica quando disponível, transmite eventos, interrompe e encerra sem expor segredos.
3. Threads, turns e eventos normalizados persistem e retomam.
4. Toda IPC privilegiada aplica política, valida input e output, e audita o resultado sanitizado.
5. `lint`, `typecheck`, unit, integration, security, build e Electron E2E passam nos gates aplicáveis; skips/deferências são reportados explicitamente.

## Gate final da Master Wave 1 — Wave 17

A Wave 17 continua sendo o gate de dogfood/QA da RC1 Windows. Ela não é apagada pela mudança cloud-first.

No estado cloud-first:
- a trilha RC1 Windows permanece `WINDOWS-DEFERRED` até evidência própria;
- a trilha de desenvolvimento prosseguiu sem declarar a Wave 17 `RELEASE-GREEN`;
- qualquer release Windows futura continua exigindo gates reais de startup, sessão, conversa, multi-provider, restart/recovery, isolamento A→B→A, proposal/EXPIRED, privacidade, persistência, UX/estado, pacote, E2E/ConPTY e provider local aplicável.

## Gate final da Master Wave 2

A MW2 é `CLOUD-GREEN` quando:
1. registries/contracts são provider-neutral e validados em runtime;
2. isolamento por projeto é comprovado;
3. Research/Knowledge preservam provenance/citations;
4. conteúdo externo não ganha autoridade;
5. Public API/Tool/MCP/Platform/Skill descobertos não são adotados automaticamente;
6. Skill Gate exige risco/licença/custo/dependências/permissões/provenance/aprovação;
7. nenhum registry concede autorização de runtime;
8. nenhuma credencial é versionada e nenhum DDL Supabase é aplicado implicitamente;
9. Cloud Quality Gate e Skills Snapshot Validation ficam GREEN.

Evidência: `.agent/MW2_TEST_RESULTS.md` e `.agent/MW2_HANDOFF.md`.

## Gate final da Master Wave 3

A MW3 é `CLOUD-GREEN` quando:
1. readiness separa `CLOUD_PASS`, `WINDOWS_DEFERRED`, `NOT_APPLICABLE` e `BLOCKED`;
2. `pnpm test:dogfood` executa A–K reais/reconstruídos e fica GREEN;
3. secrets/path/trust/policy têm testes negativos;
4. preview/log output é sanitizado;
5. FULL_ACCESS preserva absolute blocks;
6. Research/Knowledge/Registry continuam sem elevação automática de confiança/authority;
7. Vibe Coding Toolkit permanece Engineering Playbook Source não autoritativa;
8. nenhum secret/DDL Supabase é introduzido;
9. lint/typecheck/unit/integration/security/dogfood/build/Cloudflare ficam GREEN;
10. review não encontra bypass de Policy/Approval/Skill Gate;
11. requisitos reais Windows continuam `WINDOWS-DEFERRED`.

Evidência funcional: run `36020705177`, HEAD `2a9be68cf17c6ac65101b499fd940b76acbd6e73`.
Checkpoint documental final: run `36021301533`, HEAD `b1ddba47d907847003fa3fd3e1f07796da850703`.

## Gate final da Master Wave 4

A MW4 é `CLOUD-GREEN` quando:
1. `.agent/AGENT_REGISTRY.json` é validado por schema strict/versionado e falha fechado;
2. Agent não contém provider/model selecionado como autoridade implícita;
3. aprovação/loadout/memory/team permanecem isolados por projeto;
4. thread binding mantém project+agent+provider+model explícitos e bloqueia reuse cross-project/cross-agent/provider;
5. mudança de model com binding persistido exige rebind explícito;
6. effects do Agent são metadata/intenção e precisam de mapping canônico antes do PolicyEngine;
7. action mutável originada do Agent Runtime não recebe `runtimeExecutionAuthorized=true`; materialização continua dependente de ApprovalStore/PlanApprovalService e AuditLog;
8. effect sem materializador MW4 aprovado permanece metadata-only/negado;
9. persistência local sobrevive restart sem vazamento entre projetos;
10. security negatives cobrem injection, cross-project, FULL_ACCESS sem autoridade, undeclared/future effect e Agent disabled;
11. dogfood canônico executa Registry→Projects→Team→Thread→Dispatch→Gate→restart;
12. nenhum secret/DDL Supabase/runtime MW5 é introduzido;
13. lint, typecheck, unit, integration, security, dogfood, build e Cloudflare preview/MW0–MW5 ficam GREEN.

Evidência funcional: Cloud Quality Gate run `36025944421`, HEAD `0b1a64efe6f55ab890f2d30d5156b362f0f936aa`.

Documentação canônica: `.agent/MW4_EXECUTION_PLAN.md`, `.agent/MW4_TEST_RESULTS.md` e `.agent/MW4_HANDOFF.md`.

## Protocolo de execução

Para cada wave cloud-first: teste → correção → review do diff → atualização de STATUS/TEST_RESULTS/handoff → commit/checkpoint → próxima wave quando `CLOUD-GREEN`.

Para release Windows: executar certificação específica e somente então promover para `RELEASE-GREEN`.
