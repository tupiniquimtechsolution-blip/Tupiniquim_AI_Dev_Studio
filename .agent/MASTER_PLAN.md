# Plano Mestre Operacional

## Autoridade e estado reconciliado

Este plano operacionaliza o Prompt Mestre de 2026-08-17. Git, código e testes prevalecem sobre documentação histórica. A implementação preservada em `66f94a7` mistura entregas da antiga Wave 4 com código antecipado das Waves 5–10; ela será consolidada sem descartar componentes válidos.

Desde 2026-09-24, o desenvolvimento adota operação **cloud-first**. GitHub é a fonte de verdade e ambiente canônico de desenvolvimento/CI. `F:\CODEX\Tupiniquim-AI-Dev-Studio` permanece a raiz obrigatória para certificação Windows física/local, não para o ciclo diário de desenvolvimento.

Estados de gate:
- `CLOUD-GREEN`: gates cloud compatíveis passam no GitHub Actions.
- `WINDOWS-DEFERRED`: requisitos Windows reais seguem pendentes e não podem ser reportados como aprovados.
- `RELEASE-GREEN`: cloud + certificações obrigatórias de release estão comprovadas.

## Waves

| Wave Mestre | Escopo | Estado |
|---:|---|---|
| 0 | Fundação confiável: isolamento local, AIProvider, persistência, IPC/PolicyEngine, E2E e redaction | CONCLUÍDA; checkpoint/wave-04 |
| 1 | Dev AI local autônomo: runtime local, agente, workspace, memória, contexto e browser QA | CLOUD-GREEN PENDENTE / WINDOWS-DEFERRED; Wave 17/RC1 permanece aberta no PR #32 e não é declarada V1 GREEN |
| 2 | Research, Knowledge, Technology/Tool/MCP/Skill Registries | AUTORIZADA EM TRILHA CLOUD após fundação cloud-first; não implica fechamento da RC1 Windows |
| 3 | Dev Studio completo, hardening e dogfood controlado | PENDENTE; poderá iniciar após Master Wave 2 `CLOUD-GREEN` |
| 4 | Tupiniquim AI Studio: Agent Registry e Agents → Projects/Threads | PENDENTE |
| 5 | Multimodal, automação e voz, conforme hardware | PENDENTE |

## Política de avanço cloud-first

1. Uma Master Wave pode avançar quando sua antecessora estiver `CLOUD-GREEN` para o escopo cloud compatível.
2. Capacidades não reproduzíveis em nuvem ficam marcadas `WINDOWS-DEFERRED`, nunca PASS fictício.
3. Electron packaging, ConPTY, Ollama local/hardware e fluxos OAuth humanos permanecem gates de release quando aplicáveis.
4. Cloudflare hospeda control-plane/preview e não substitui runtime Windows.
5. Supabase permanece platform source opcional por projeto; nenhuma adoção global implícita.
6. Google Drive pode receber cópias de evidências/builds, mas não substitui GitHub como fonte de verdade.
7. PR #32 permanece DRAFT/não mergeado até decisão baseada em evidência própria da RC1 Windows.

## Mapeamento de legado

- Antiga Wave 4 = Wave Mestre 0.
- Plan/Approval/Execute, Research/Resolver, Prompt, Visual, Preferences e Preview presentes no WIP são candidatos às Waves 2–3; não constituem aceite até terem fronteiras, testes e integração confirmados.
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

- Avaliar seletivamente o Vibe Coding Toolkit como Engineering Playbook Source: brainstorm→plan, subagent waves, code review e quality gates.
- Regras externas continuam referências. Limites rígidos como “350 linhas por arquivo” só viram requisito se compatíveis com a arquitetura real.
- Hardening/dogfood permanece gate antes do Agent Runtime completo.

### Wave 4

- Materializar `.agent/AGENT_REGISTRY.json` em contratos Zod/runtime.
- Provider/model selecionados separadamente do Agent.
- Efeitos mutáveis são capabilities submetidas a PolicyEngine/ApprovalStore/AuditLog; um booleano simples não concede autoridade.
- Equipes, memória e loadouts permanecem isolados por projeto.

### Wave 5

- `Anil-matcha/Open-Generative-AI` como principal capability source do Illustrator / Media Agent.
- Gemini video presets (`/reveal`, `/teardown`, `/explodedview`) como aliases internos de prompt; provider real somente após contrato aprovado.
- Pocket TTS para TTS local/voz.
- OpenReply para automação social.
- kimi-k3-in-c apenas como pesquisa experimental.

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
- a trilha de desenvolvimento pode prosseguir para Master Wave 2 sem declarar a Wave 17 `RELEASE-GREEN`;
- qualquer release Windows futura continua exigindo os gates reais de startup, sessão, conversa, multi-provider, restart/recovery, isolamento A→B→A, proposal/EXPIRED, privacidade, persistência, UX/estado, pacote, E2E/ConPTY e provider local aplicável.

## Protocolo de execução

Para cada wave cloud-first: teste → correção → review do diff → atualização de STATUS/TEST_RESULTS/handoff → commit/checkpoint → próxima wave quando `CLOUD-GREEN`.

Para release Windows: executar certificação específica e somente então promover para `RELEASE-GREEN`.
