# Plano Mestre Operacional

## Autoridade e estado reconciliado

Este plano operacionaliza o Prompt Mestre de 2026-08-17. Git, código e testes prevalecem sobre documentação histórica. A implementação preservada em `66f94a7` mistura entregas da antiga Wave 4 com código antecipado das Waves 5–10; ela será consolidada sem descartar componentes válidos.

O ambiente desta máquina usa `F:\\CODEX\\Tupiniquim-AI-Dev-Studio`. O ADR 0012 substitui o ADR 0011 apenas quanto à letra do volume e preserva a cadeia histórica.

## Waves

| Wave Mestre | Escopo | Estado |
|---:|---|---|
| 0 | Fundação confiável: isolamento local, AIProvider, persistência, IPC/PolicyEngine, E2E e redaction | CONCLUÍDA; checkpoint/wave-04 |
| 1 | Dev AI local autônomo: runtime local, agente, workspace, memória, contexto e browser QA | EM ANDAMENTO; checkpoint/wave-13 cobre runtime, contexto, baseline, histórico, manifestos, escrita, retomada e ciclo aprovado de propostas efêmeras |
| 2 | Research, Knowledge, Technology/Tool/MCP/Skill Registries | PENDENTE |
| 3 | Dev Studio completo, hardening e dogfood controlado | PENDENTE |
| 4 | Tupiniquim AI Studio: Agent Registry e Agents → Projects/Threads | PENDENTE |
| 5 | Multimodal, automação e voz, conforme hardware | PENDENTE |

## Mapeamento de legado

- Antiga Wave 4 = Wave Mestre 0.
- Plan/Approval/Execute, Research/Resolver, Prompt, Visual, Preferences e Preview presentes no WIP são candidatos às Waves 2–3; não constituem aceite até terem fronteiras, testes e integração confirmados.
- Não será adicionado um provider local antes de estabilizar o contrato `AIProvider`.

## Aceite da Wave 0

1. Scripts, dados, caches e testes usam somente o volume operacional autorizado, atualmente F:.
2. O transporte Codex stdio JSONL inicializa, autentica quando disponível, transmite eventos, interrompe e encerra sem expor segredos.
3. Threads, turns e eventos normalizados persistem e retomam.
4. Toda IPC privilegiada aplica política, valida input e output, e audita o resultado sanitizado.
5. `lint`, `typecheck`, unit, integration, security, build e Electron E2E passam. Inferência sem créditos é relatada como bloqueio externo, não como aprovação falsa.

## Extensão aprovada — Agent Ecosystem e Skill Deck

A visão operacional incorpora fontes externas como **capability sources**, mantendo a separação:

`Agent != Model != Provider != Tool != Skill != Source Repository`

### Wave Mestre 2 — expansão

A Wave 2 passa a incluir:

1. Research Agent usando padrões do Awesome LLM Apps e Agent Reach.
2. Knowledge/RAG Registry usando padrões RAG do Awesome LLM Apps.
3. Technology/Tool Registry, incluindo CLI-Anything como fonte de CLIs agent-native.
4. Skill Registry com Top 500 All-Time do skills.sh, Top 500 Trending como watchlist e `find-skills` pinned.
5. Skill Gate com licença, custo, dependências, auditoria, permissões e provenance.
6. Prompt Architect usando Prompt Master como fonte de skill.
7. UI/UX advisor usando UI UX Pro Max como fonte.
8. Agent Registry machine-readable em `.agent/AGENT_REGISTRY.json`.

### Wave Mestre 4 — expansão

O Agent Registry futuro deve materializar equipes por projeto e permitir que cada agente possua:

- role;
- provider/model;
- tool set;
- skill loadout;
- project-scoped memory;
- permissions;
- task queue;
- runtime state;
- source provenance.

Awesome LLM Apps é a principal **Agent Pattern Library** para compor equipes, não um runtime único.

### Wave Mestre 5 — expansão

A camada multimodal/voz deverá considerar:

- `Anil-matcha/Open-Generative-AI` como fonte principal do Illustrator / Media Agent;
- `kyutai-labs/pocket-tts` para TTS local e futuro Jarvis;
- `diwenne/openreply` para Social Automation;
- `FareedKhan-dev/kimi-k3-in-c` apenas como pesquisa experimental de runtime local extremo.

Serviços externos pagos permanecem `NOT_CONFIGURED` até decisão explícita.

## Protocolo de execução

Para cada wave: teste → correção → review do diff → atualização de STATUS/TEST_RESULTS/handoff → commit `wave-NN:` → tag `checkpoint/wave-NN` → próxima wave.
