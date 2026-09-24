# PR Reconciliation Matrix — Pós-Master-Waves

Data: 2026-09-24
Issue: #45

| PR | Head | Relação com release baseline | Classificação inicial | Ação |
|---:|---|---|---|---|
| #32 | `arena/01a0c8ba-tupiniquim-ai-dev-studio` | ancestor da linha MW5 via #33 | ABSORBED-IN-STACK | manter aberto até certificação Windows do exact release head; não mergear isoladamente |
| #33 | `cloud/master-wave-2-foundation` | ancestor da linha MW5 | ABSORBED-IN-STACK | provenance; fechar após integração final |
| #36 | `cloud/mw2-research-knowledge-registries` | ancestor da linha MW5 | ABSORBED-IN-STACK | provenance; fechar após integração final |
| #39 | `cloud/mw3-dev-studio-hardening-dogfood` | ancestor da linha MW5 | ABSORBED-IN-STACK | provenance; fechar após integração final |
| #41 | `cloud/mw4-agent-registry-project-threads` | parent direto da MW5 | ABSORBED-IN-STACK | provenance; fechar após integração final |
| #43 | `cloud/mw5-multimodal-automation-voice` | baseline exato da release branch | RELEASE-BASELINE | preservar imutável; fechar após integração final |
| #29 | `arena/01a0b055-tupiniquim-ai-dev-studio` | MW5 140 commits ahead / 0 behind | ABSORBED | fechar sem merge como superseded pela linha RC1→MW5 |
| #30 | `toolbox/knowledge-import-20260918` | diverged: release 141 ahead / PR 6 commits próprios | REVIEW-REQUIRED | revisar conteúdo único e portar seletivamente |
| #31 | `toolbox/ingest-2026-09-18` | diverged: release 141 ahead / PR 8 commits próprios | REVIEW-REQUIRED | revisar conteúdo único e portar seletivamente |
| #13 | `toolbox/google-skills-20260904` | diverged: release 174 ahead / PR 11 commits próprios | REVIEW-REQUIRED | reconciliar first-party google/skills com registries/loadouts atuais |

## Regras de classificação

### ABSORBED
O head do PR é ancestor da linha release. Pode ser fechado como superseded sem merge individual, desde que a classificação esteja documentada.

### ABSORBED-IN-STACK
Conteúdo faz parte da cadeia principal de Master Waves. O PR é mantido como provenance até a integração final; depois pode ser fechado sem merge individual.

### RELEASE-BASELINE
Checkpoint imutável que originou a branch de release.

### REVIEW-REQUIRED
Há commits laterais não ancestrais. Não mergear a branch. Comparar arquivos contra o estado atual e decidir individualmente:
- `PORT_SELECTED`: conteúdo ainda válido é recriado/portado no release head com provenance;
- `OBSOLETE`: conteúdo substituído por implementação/documentação posterior;
- `DEFERRED`: conteúdo útil, mas fora do release atual.

## Observações comprovadas

### #29
O compare `arena/01a0b055-tupiniquim-ai-dev-studio...cloud/mw5-multimodal-automation-voice` retorna `ahead`, 140 commits ahead / 0 behind para MW5. O fix Wave17 está absorvido.

### #30 e #31
Ambos saem do mesmo baseline histórico `b35a3be...` e divergem da linha release. #30 e #31 também divergem entre si; portanto #31 não pode ser tratado automaticamente como superseding completo de #30.

### #13
A linha atual contém Skill Registry/MW4/MW5, mas os 11 commits próprios de #13 não são ancestrais. A presença conceitual de Google skills em documentação posterior não prova equivalência textual/funcional; revisão por arquivo é obrigatória.
