# Gemini Adapter — Tupiniquim

@./AGENTS.md

A skill universal do projeto está em `.agents/skills/tupiniquim-toolbox/SKILL.md` e é a fonte canônica para o fluxo Tupiniquim.

## Presets de vídeo

Quando o usuário usar `/reveal`, `/teardown` ou `/explodedview` em contexto visual/vídeo, trate-os como **aliases internos do Tupiniquim**, não como comandos oficiais do Gemini.

Fonte:
- `docs/AI_TOOLBOX/GEMINI_VIDEO_PRESETS.md`
- `packages/core/src/gemini-video-presets.ts`

Não invente os “100+ códigos” citados no vídeo: somente aliases registrados no catálogo podem ser expandidos.

Não duplique regras neste arquivo. Em caso de conflito, `AGENTS.md` prevalece.
