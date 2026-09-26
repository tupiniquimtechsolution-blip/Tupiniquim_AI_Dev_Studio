# PR Reconciliation Matrix — Pós-Master-Waves

Data: 2026-09-24
Issue: #45

| PR | Head | Relação com release baseline | Classificação final | Ação |
|---:|---|---|---|---|
| #32 | `arena/01a0c8ba-tupiniquim-ai-dev-studio` | ancestor da linha MW5 via #33 | ABSORBED-IN-STACK | manter provenance até certificação Windows final; não mergear isoladamente |
| #33 | `cloud/master-wave-2-foundation` | ancestor da linha MW5 | ABSORBED-IN-STACK | provenance; fechar após integração final |
| #36 | `cloud/mw2-research-knowledge-registries` | ancestor da linha MW5 | ABSORBED-IN-STACK | provenance; fechar após integração final |
| #39 | `cloud/mw3-dev-studio-hardening-dogfood` | ancestor da linha MW5 | ABSORBED-IN-STACK | provenance; fechar após integração final |
| #41 | `cloud/mw4-agent-registry-project-threads` | parent direto da MW5 | ABSORBED-IN-STACK | provenance; fechar após integração final |
| #43 | `cloud/mw5-multimodal-automation-voice` | baseline exato da release branch | RELEASE-BASELINE | preservar como checkpoint; fechar após integração final |
| #29 | `arena/01a0b055-tupiniquim-ai-dev-studio` | MW5 140 commits ahead / 0 behind | ABSORBED | fechar sem merge como superseded pela linha RC1→MW5 após release |
| #30 | `toolbox/knowledge-import-20260918` | lateral/diverged | PORT_SELECTED / SELECTIVELY-ABSORBED | knowledge pack/policies preservados; Source Gate, Free Claude Code/OpenManus routing, security hardening e canary não sensível reconciliados na skill/contrato atual; não mergear branch histórica |
| #31 | `toolbox/ingest-2026-09-18` | lateral/diverged | PORT_SELECTED / SELECTIVELY-ABSORBED | Secret Gate, knowledge packs, media/3D/Higgsfield review e sync seguro já preservados na linha release; não mergear branch histórica |
| #13 | `toolbox/google-skills-20260904` | lateral/diverged | PORT_SELECTED + SUPERSEDED | docs/sync/routing first-party Google preservados e reconciliados em AGENTS/Toolbox/Multi-LLM; extensão antiga de `AGENT_REGISTRY.json` é superseded pelo schema strict MW4 e não será ressuscitada |

## Regras de classificação

### ABSORBED
O head do PR é ancestor da linha release. Pode ser fechado como superseded sem merge individual quando a integração final estiver concluída.

### ABSORBED-IN-STACK
Conteúdo faz parte da cadeia principal de Master Waves. O PR é mantido como provenance até a integração final; depois pode ser fechado sem merge individual.

### RELEASE-BASELINE
Checkpoint imutável que originou a branch de release.

### PORT_SELECTED / SELECTIVELY-ABSORBED
O PR lateral não é mergeado. Conteúdo ainda válido é verificado contra a arquitetura atual e recriado/retido seletivamente no release head, preservando provenance e descartando estruturas substituídas.

### SUPERSEDED
A intenção do conteúdo continua válida, mas a forma antiga foi substituída por contrato/arquitetura posterior. Não reintroduzir schema ou autoridade antiga só para obter equivalência textual.

## Evidência de reconciliação

### #29
O compare histórico comprova que a linha MW5 está 140 commits ahead / 0 behind em relação à antiga branch `arena/01a0b055-tupiniquim-ai-dev-studio`; o fix Wave17 foi absorvido pela linha principal.

### #30 — Knowledge Import
Conteúdo preservado na linha release inclui `KNOWLEDGE_IMPORT_2026-09-18.md`, catálogo/security baseline e knowledge packs. A reconciliação final porta para `.agents/skills/tupiniquim-toolbox/SKILL.md` apenas as regras ainda úteis:
- OpenManus como reference source para agent/planning/MCP/sandbox;
- Free Claude Code como reference source de multi-provider/harness sem auto-fallback global;
- Source Gate `origem → licença/ref → scripts/dependências → permissões/rede → secrets → custo → testes → decisão`;
- reforço de rate limit vs DDoS upstream, cryptography segura e privileged tooling atrás de policy/approval;
- canary somente não sensível, como detector e nunca fonte de verdade.

A branch #30 não deve ser mergeada integralmente porque a linha atual já contém implementação/documentação posterior e uma divisão mais segura dos scripts de sync.

### #31 — External sources, media e 3D
A linha release já contém:
- `docs/AI_TOOLBOX/EXTERNAL_SOURCE_AND_SECRET_GATE.md`;
- `docs/AI_TOOLBOX/MEDIA_AND_3D_REFERENCES_2026-09-18.md`;
- `KNOWLEDGE_PACK*_2026-09-18.json`;
- `scripts/sync-ai-toolbox-extra-sources.ps1`.

Esses artefatos preservam a distinção descoberta != autorização, recusam segredo público como credencial utilizável, mantêm WorldClaw como research reference e Higgsfield como capability oficial/guarded quando configurada. Não há motivo para mergear a branch histórica.

### #13 — google/skills
A linha release já preserva `docs/AI_TOOLBOX/GOOGLE_SKILLS.md`, `GEMINI.md`, `AGENT_ECOSYSTEM.md` e `google__skills` em `scripts/sync-ai-toolbox.ps1`. A reconciliação final adiciona o roteamento também ao contrato universal (`AGENTS.md`), à skill corporativa e à arquitetura Multi-LLM.

A proposta antiga de inserir `firstPartySkillSources`/`conditionalPinned` diretamente em `.agent/AGENT_REGISTRY.json` é **SUPERSEDED**. Desde MW4, o Agent Registry é Zod strict/versionado e representa Agents/assignments/effects; fonte de skill não recebe authority nem deve expandir o schema por uma branch histórica. Uma futura materialização de fontes first-party deve ganhar contrato próprio compatível com Skill Registry/Gate, se necessária.

## Resultado

Não resta nenhum PR lateral `REVIEW-REQUIRED` por conteúdo. A integração ainda não é `RELEASE-GREEN`: Cloud/Windows/final security gates precisam passar no **exact final release SHA** depois deste checkpoint.
