# RELEASE-GREEN Gate Matrix

Issue: #45
PR: #46
Branch: `release/post-master-waves-integration`
Auditoria: 2026-09-26
Baseline auditado: `9120c6e6a2e8bfb572bed867c511921df9a98349`

| Gate | Ambiente | Estado auditado | Evidência / condição |
|---|---|---|---|
| Topology `main...release` | GitHub | PASS | baseline 186 ahead / 0 behind; sem force push |
| PR reconciliation | GitHub | PASS | #29 absorvido; #13/#30/#31 reconciliados seletivamente; nenhum lateral REVIEW-REQUIRED |
| lint | Cloud CI | PASS no baseline | GitHub Actions exact baseline |
| typecheck | Cloud CI | PASS no baseline | GitHub Actions exact baseline |
| unit | Cloud CI | PASS no baseline | GitHub Actions exact baseline |
| integration | Cloud CI | PASS no baseline | GitHub Actions exact baseline + skips explicitados pela suíte |
| security | Cloud CI | PASS no baseline | GitHub Actions exact baseline |
| dogfood | Cloud CI | PASS no baseline | MW3 A–K + MW4 + MW5 |
| build | Cloud CI | PASS no baseline | Electron/Vite build |
| Cloudflare preview/MW0–MW5 | Cloud CI | PASS no baseline | dry-runs |
| Skills Snapshot | Cloud CI | PASS no baseline | workflow dedicado |
| Windows hosted scripts | GitHub Windows | PASS no baseline | Windows script fixtures |
| Electron E2E hosted | GitHub Windows | PASS no baseline | hosted Windows E2E |
| package:win hosted | GitHub Windows | PASS no baseline | pacote + artifact upload |
| final secrets review | GitHub/repo | PASS | sem `.env`/`.npmrc`/PEM rastreados; credentials via GitHub Secrets nos workflows auditados |
| final Policy/Approval review | GitHub/repo | PASS | absolute blocks + approval/effectsHash + runtimeExecutionAuthorized=false preservados |
| final provenance review | GitHub | PASS | matriz lateral concluída; sem review thread aberto no PR #46 |
| documentação | GitHub | PASS COM CHECKPOINT | drift hosted corrigido pelo Final Release Audit/STATUS |
| exact-head automated revalidation após audit docs | GitHub Actions | REQUIRED | CI + Skills + Cloud + Windows hosted devem ficar GREEN no commit documental atual |
| Windows físico `F:` | equipamento real | PENDING | checkout exact final SHA + `validate:f-drive` |
| Windows scripts físicos | equipamento real | PENDING | `test:rc1-windows-scripts` / verify RC1 real |
| Electron E2E físico | equipamento real | PENDING | cenários aplicáveis sem skips indevidos |
| ConPTY/Terminal físico | equipamento real | PENDING | terminal real funcional |
| package:win + installer smoke | equipamento real | PENDING | pacote completo + execução/smoke do artefato |
| Ollama/local runtime | equipamento real | PENDING / APPLICABLE | runtime/model required comprovado quando gate aplicável |
| restart/recovery | equipamento real | PENDING | shutdown/restart/recovery e persistência reais |
| A→B→A isolation | equipamento real | PENDING | nenhum vazamento entre workspaces/projects |
| proposal/EXPIRED | equipamento real | PENDING | authority fail-closed comprovada |
| privacy/redaction | Cloud + equipamento real | PARTIAL PASS / PENDING PHYSICAL | security/hosted PASS; superfícies físicas ainda precisam certificar |
| OAuth humano | ambiente real | CONDITIONAL | somente se requisito de release exigir integração real |
| `RELEASE-GREEN` | conjunto | BLOCKED | exact-head automation + todos os gates físicos obrigatórios GREEN no MESMO SHA |

## Classificação atual

`AUDIT-GREEN / HOSTED-GREEN / LOCAL-CERT-PENDING / NOT RELEASE-GREEN`

O Windows hosted é evidência suplementar e não substitui a certificação física exigida pela Issue #45 e pelo Release & Integration Plan.

## Regra de SHA

Cada evidência deve registrar o SHA exato. O baseline `9120c6e6a2e8bfb572bed867c511921df9a98349` provou o conjunto hosted antes deste checkpoint documental. Como a auditoria versionada cria um novo commit, os quatro workflows automatizados devem ser reexecutados no novo HEAD. A certificação física deve então usar esse MESMO final SHA.

## Promoção

`RELEASE-GREEN` só pode ser escrito depois que:

1. CI, Skills Snapshot, Cloud Quality e Windows hosted estiverem GREEN no exact final HEAD;
2. a certificação Windows física obrigatória estiver GREEN no mesmo SHA;
3. OAuth/hardware condicionais aplicáveis estiverem resolvidos ou explicitamente não aplicáveis;
4. nenhum blocker novo de secrets/policy/provenance/docs existir.

Até lá, PR #46 permanece DRAFT e não deve ser mergeado.
