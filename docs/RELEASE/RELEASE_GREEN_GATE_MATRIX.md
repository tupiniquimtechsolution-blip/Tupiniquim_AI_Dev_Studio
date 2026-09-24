# RELEASE-GREEN Gate Matrix

Issue: #45
Branch: `release/post-master-waves-integration`

| Gate | Ambiente | Estado inicial | Evidência exigida |
|---|---|---|---|
| Topology `main...release` | GitHub | PASS baseline | `ahead`, `behind_by=0`, sem force push |
| PR reconciliation | GitHub | IN PROGRESS | #29 classificado; #13/#30/#31 revisados por conteúdo |
| lint | Cloud CI | PENDING exact release head | GitHub Actions PASS |
| typecheck | Cloud CI | PENDING exact release head | GitHub Actions PASS |
| unit | Cloud CI | PENDING exact release head | PASS com contagens |
| integration | Cloud CI | PENDING exact release head | PASS + skips de ambiente explicitados |
| security | Cloud CI | PENDING exact release head | PASS; secrets/policy/provenance negatives |
| dogfood | Cloud CI | PENDING exact release head | MW3 A–K + MW4 + MW5 PASS |
| build | Cloud CI | PENDING exact release head | Electron/Vite build PASS |
| Cloudflare preview/MW0–MW5 | Cloud CI | PENDING exact release head | dry-run PASS |
| Windows scripts | Windows F: | PENDING | `test:rc1-windows-scripts` PASS |
| Electron E2E | Windows F: | PENDING | cenários aplicáveis executados sem skips indevidos |
| ConPTY/Terminal | Windows F: | PENDING | terminal real funcional |
| package:win | Windows F: | PENDING | pacote completo PASS |
| Ollama/local runtime | Windows F: | PENDING | runtime/model required comprovado quando gate aplicável |
| restart/recovery | Windows F: | PENDING | shutdown/restart/recovery e persistência reais |
| A→B→A isolation | Windows F: | PENDING | nenhum vazamento entre workspaces/projects |
| proposal/EXPIRED | Windows F: | PENDING | authority fail-closed comprovada |
| privacy/redaction | Cloud + Windows | PENDING final | markers privados ausentes das superfícies proibidas |
| OAuth humano | ambiente real | NOT_CONFIGURED / CONDITIONAL | somente se requisito de release exigir integração real |
| final diff/security review | GitHub | PENDING | sem bypass, secrets ou drift documental |
| `RELEASE-GREEN` | conjunto | BLOCKED | todos os gates obrigatórios acima GREEN no mesmo SHA |

## Regra de SHA

Cada evidência deve registrar o SHA exato. Evidência produzida para o PR #32 ou para um checkpoint MW anterior não promove automaticamente o HEAD de release.

## Promoção

`RELEASE-GREEN` só pode ser escrito em STATUS/release metadata depois que o conjunto obrigatório desta matriz estiver comprovado no exact head da branch de release.
