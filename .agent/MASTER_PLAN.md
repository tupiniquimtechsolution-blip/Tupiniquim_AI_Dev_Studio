# Plano Mestre Operacional

## Autoridade e estado reconciliado

Este plano operacionaliza o Prompt Mestre de 2026-08-17. Git, código e testes prevalecem sobre documentação histórica. A implementação preservada em `66f94a7` mistura entregas da antiga Wave 4 com código antecipado das Waves 5–10; ela será consolidada sem descartar componentes válidos.

O ambiente desta máquina usa `D:\CODEX\Tupiniquim-AI-Dev-Studio`. O ADR 0011 substitui o ADR 0010 apenas quanto à letra do volume.

## Waves

| Wave Mestre | Escopo | Estado |
|---:|---|---|
| 0 | Fundação confiável: migração D:, AIProvider, persistência, IPC/PolicyEngine, E2E e redaction | CONCLUÍDA; checkpoint/wave-04 |
| 1 | Dev AI local autônomo: runtime local, agente, workspace, memória, contexto e browser QA | EM ANDAMENTO; checkpoint/wave-08 cobre runtime, contexto, baseline e histórico recuperável |
| 2 | Research, Knowledge, Technology/Tool/MCP/Skill Registries | PENDENTE |
| 3 | Dev Studio completo, hardening e dogfood controlado | PENDENTE |
| 4 | Tupiniquim AI Studio: Agent Registry e Agents → Projects/Threads | PENDENTE |
| 5 | Multimodal, automação e voz, conforme hardware | PENDENTE |

## Mapeamento de legado

- Antiga Wave 4 = Wave Mestre 0.
- Plan/Approval/Execute, Research/Resolver, Prompt, Visual, Preferences e Preview presentes no WIP são candidatos às Waves 2–3; não constituem aceite até terem fronteiras, testes e integração confirmados.
- Não será adicionado um provider local antes de estabilizar o contrato `AIProvider`.

## Aceite da Wave 0

1. Scripts, dados, caches e testes usam somente D:.
2. O transporte Codex stdio JSONL inicializa, autentica quando disponível, transmite eventos, interrompe e encerra sem expor segredos.
3. Threads, turns e eventos normalizados persistem e retomam.
4. Toda IPC privilegiada aplica política, valida input e output, e audita o resultado sanitizado.
5. `lint`, `typecheck`, unit, integration, security, build e Electron E2E passam. Inferência sem créditos é relatada como bloqueio externo, não como aprovação falsa.

## Protocolo de execução

Para cada wave: teste → correção → review do diff → atualização de STATUS/TEST_RESULTS/handoff → commit `wave-NN:` → tag `checkpoint/wave-NN` → próxima wave.
