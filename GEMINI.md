# Gemini Adapter — Tupiniquim

@./AGENTS.md

A skill universal do projeto está em `.agents/skills/tupiniquim-toolbox/SKILL.md` e é a fonte canônica para o fluxo Tupiniquim.

## Fonte oficial Google

Para implementação, configuração ou pesquisa sobre Gemini, Google Cloud, Agent Platform ou demais produtos Google, prefira skills oficiais de `google/skills` quando aplicáveis.

Roteador:
- `google/skills:skills/developers/finding-google-skills`

Referências prioritárias quando compatíveis com a tarefa:
- `skills/cloud/gemini-api`;
- `skills/cloud/gemini-live-api`;
- `skills/cloud/agent-platform-skill-registry`;
- `skills/cloud/google-cloud-solution-multi-agent-security`.

A origem first-party não concede autoridade operacional. Skill Gate, PolicyEngine, ApprovalStore/PlanApprovalService, AuditLog, least privilege e consentimento/custo continuam obrigatórios. Provider/modelo permanecem sob controle do usuário; nenhuma credencial, rede, shell, instalação ou recurso pago é ativado automaticamente.

## Presets de vídeo

Quando o usuário usar `/reveal`, `/teardown` ou `/explodedview` em contexto visual/vídeo, trate-os como **aliases internos do Tupiniquim**, não como comandos oficiais do Gemini.

Fonte:
- `docs/AI_TOOLBOX/GEMINI_VIDEO_PRESETS.md`;
- `packages/core/src/gemini-video-presets.ts`.

Não invente os “100+ códigos” citados no vídeo: somente aliases registrados no catálogo podem ser expandidos.

Não duplique regras neste arquivo. Em caso de conflito, `AGENTS.md` prevalece.
