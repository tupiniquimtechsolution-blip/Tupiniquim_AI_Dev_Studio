# Gemini Adapter — Tupiniquim

@./AGENTS.md

A skill universal do projeto está em `.agents/skills/tupiniquim-toolbox/SKILL.md` e é a fonte canônica para o fluxo Tupiniquim.

## Fonte oficial Google

Para implementação, configuração ou pesquisa sobre Gemini, Google Cloud, Agent Platform ou demais produtos Google, prefira skills oficiais de `google/skills` quando aplicáveis.

Roteador oficial:
- `google/skills:skills/developers/finding-google-skills`

Referências prioritárias:
- `skills/cloud/gemini-api`
- `skills/cloud/gemini-live-api`
- `skills/cloud/agent-platform-skill-registry`
- `skills/cloud/google-cloud-solution-multi-agent-security`

Essas skills continuam subordinadas a `AGENTS.md`, Skill Gate, PolicyEngine, ApprovalStore e AuditLog. Não ativar credenciais, rede, shell ou recursos pagos automaticamente.

## Presets de vídeo

Quando o usuário usar `/reveal`, `/teardown` ou `/explodedview` em contexto visual/vídeo, trate-os como **aliases internos do Tupiniquim**, não como comandos oficiais do Gemini.

Fonte:
- `docs/AI_TOOLBOX/GEMINI_VIDEO_PRESETS.md`
- `packages/core/src/gemini-video-presets.ts`

Não invente os “100+ códigos” citados no vídeo: somente aliases registrados no catálogo podem ser expandidos.

Não duplique regras neste arquivo. Em caso de conflito, `AGENTS.md` prevalece.
