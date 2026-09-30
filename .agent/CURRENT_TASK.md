# Current Task

## Estabilização e certificação Release Green

**Estado: RELEASE_CANDIDATE_READY — aguardando merge do PR #80 e destravas externas.**

Objetivo: RELEASE_GREEN comprovado ponta a ponta (metodologia Agenor:
BUILD PASSOU ≠ PRODUTO FUNCIONA). Fonte canônica do inventário:
`docs/RELEASE/RELEASE_GREEN_AUDIT.md`.

Checklist do ciclo atual:
- [x] Auditoria total (git/PRs/CI/código/config/Cloudflare/UI/testes)
- [x] Corrigir parser Workers AI (JSON bruto/reasoning) + testes
- [x] Estados do Remote Runtime na UI/gates + testes
- [x] Resolver o falso "pré-existente" de integration/security (TEMP)
- [x] Gates locais completos PASS + dry-runs MW0–MW5
- [x] Docs de release (AUDIT/CHECKLIST/LIMITATIONS/RUNBOOK/ROLLBACK)
- [x] PR #80 aberto e verde no cloud-quality
- [ ] Merge do #80 (autorização do mantenedor)
- [ ] Web Product Smoke no SHA de merge
- [ ] RG-05/RG-08/RG-09 (externos — ver NEXT_ACTION)
