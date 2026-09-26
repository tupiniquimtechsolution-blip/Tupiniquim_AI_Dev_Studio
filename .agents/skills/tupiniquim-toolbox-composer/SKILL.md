---
name: tupiniquim-toolbox-composer
description: Curadoria e ingestão contínua de vídeos, carrosséis, repositórios, ferramentas e técnicas no Tupiniquim Toolbox, com evidence-first, provenance, security gate, deduplicação, Knowledge Packs, impacto por projeto e Agenor.
---

# Tupiniquim Toolbox Composer

Use esta skill quando o usuário fornecer ou indicar conteúdo externo que possa gerar conhecimento reutilizável para um ou mais projetos Tupiniquim.

## Fontes obrigatórias

Leia e aplique:

- `docs/AI_TOOLBOX/TOOLBOX_COMPOSER_AGENT.md`
- `docs/AI_TOOLBOX/CONTENT_INGESTION_STANDARD.md`
- `docs/AI_TOOLBOX/TOOLBOX_KNOWLEDGE_SCHEMA.json`
- `docs/AI_TOOLBOX/SECURITY_BASELINE.md`
- `docs/AI_TOOLBOX/REPOSITORIES.md`
- `docs/AI_TOOLBOX/EXTERNAL_SOURCE_AND_SECRET_GATE.md` quando disponível na linha integrada
- `.agents/skills/tupiniquim-toolbox/SKILL.md`

## Método

1. Evidence first.
2. Não preencher lacunas da fonte por conhecimento genérico sem marcar como pesquisa/inferência.
3. Separar `MEDIA_CONFIRMED`, `SOURCE_VERIFIED`, `CODE_REVIEWED`, `SANDBOX_TESTED` e `PROJECT_VALIDATED`.
4. Identificar entidades e técnicas.
5. Verificar upstream/licença/segurança/custo/fit quando houver candidato externo.
6. Aplicar secret gate.
7. Deduplicar contra o Toolbox.
8. Produzir Knowledge Units atômicas.
9. Mapear impacto em projetos sem auto-apply.
10. Gerar `TOOLBOX_UPDATE_PLAN` e `AGENOR_UPDATE`.

## Vídeo/carrossel

- preserve ordem/frame/slide;
- áudio não transcrito = pendente;
- texto ilegível = unknown;
- claim de marketing != fato técnico;
- ferramenta/repo visível deve ser verificado antes de ser tratado como upstream oficial.

## Hard stops

Nunca:

- copiar/testar credenciais públicas;
- tratar descoberta como autorização;
- ativar ferramenta paga sem aprovação;
- executar pentest em alvo de terceiro;
- alterar todos os projetos automaticamente;
- sobrescrever regra canônica por causa de um post/vídeo;
- declarar adoção/teste sem evidência.

## Output

Use o formato definido em `PROMPT_TOOLBOX_COMPOSER_AGENT.md` e gere campos compatíveis com `TOOLBOX_KNOWLEDGE_SCHEMA.json`.
