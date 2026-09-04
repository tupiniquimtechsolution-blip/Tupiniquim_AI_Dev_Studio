# Plano Mestre Operacional

## Autoridade e estado reconciliado

Este plano operacionaliza o Prompt Mestre de 2026-08-17. Git, código e testes prevalecem sobre documentação histórica. A implementação preservada em `66f94a7` mistura entregas da antiga Wave 4 com código antecipado das Waves 5–10; ela será consolidada sem descartar componentes válidos.

O ambiente desta máquina usa `F:\CODEX\Tupiniquim-AI-Dev-Studio`. O ADR 0012 substitui o ADR 0011 apenas quanto à letra do volume e preserva a cadeia histórica.

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

## Extensões aprovadas sem alterar a ordem das Waves

### Wave 2

- Research Agent usando padrões do Awesome LLM Apps + Agent Reach.
- Knowledge/RAG Registry com isolamento por projeto e citations.
- Public APIs como catálogo de descoberta, nunca allowlist automática.
- Free Programming Books, TheAlgorithms e Coding Interview University como referências de aprendizagem/fundamentos.
- Docker Awesome Compose como biblioteca de padrões de ambiente.
- Skill Registry com Top 500 All-Time, Top 500 Trending e `find-skills` pinned.
- `google/skills` registrado como First-Party Skill Source; `finding-google-skills` atua como roteador condicional para produtos Google, sem carregamento global.
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
- Gemini Live API e Gemini API podem usar skills oficiais de `google/skills` como referência de implementação, sem antecipar provider real antes dos contratos/gates.
- OpenReply para automação social.
- kimi-k3-in-c apenas como pesquisa experimental.

## Aceite da Wave 0

1. Scripts, dados, caches e testes usam somente o volume operacional autorizado, atualmente F:.
2. O transporte Codex stdio JSONL inicializa, autentica quando disponível, transmite eventos, interrompe e encerra sem expor segredos.
3. Threads, turns e eventos normalizados persistem e retomam.
4. Toda IPC privilegiada aplica política, valida input e output, e audita o resultado sanitizado.
5. `lint`, `typecheck`, unit, integration, security, build e Electron E2E passam. Inferência sem créditos é relatada como bloqueio externo, não como aprovação falsa.

## Protocolo de execução

Para cada wave: teste → correção → review do diff → atualização de STATUS/TEST_RESULTS/handoff → commit `wave-NN:` → tag `checkpoint/wave-NN` → próxima wave.
