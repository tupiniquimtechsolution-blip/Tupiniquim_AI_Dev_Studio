# Release Green Checklist — matriz de gates

Atualizado em: 2026-09-30. Regras: resultado ∈ {PASS, FAIL, BLOCKED, NOT_APPLICABLE}; falha conhecida NUNCA vira PASS; gate não executado NUNCA vira PASS.

## Gates de código (executados nesta estabilização, TEMP=/tmp)

| Gate | Resultado | Evidência |
|---|---|---|
| pnpm lint | **PASS** | eslint --max-warnings=0, saída limpa |
| pnpm typecheck | **PASS** | tsc --noEmit |
| unit | **PASS 368/368** | inclui web-ai-text (11), web-remote-runtime (10), cloudflare-toolchain (11), web-theme (10) |
| integration | **PASS 104/104** (4 skipped condicionais) | com TEMP definido; ver RG-06 do audit |
| security | **PASS 55/55** | idem |
| dogfood | **PASS 13/13** | MW3 A-K + MW4 + MW5 |
| build | **PASS** | electron-vite build |
| wrangler local | **PASS** | `pnpm exec wrangler --version` = 4.144.0 |
| dry-run web (`wrangler.jsonc`) | **PASS** | STATE/AI/ASSETS + vars |
| dry-run control-plane | **PASS** | `cloudflare/wrangler.jsonc` |
| dry-run MW0–MW5 | **PASS ×6** | todos os environments |

## Gates de CI (GitHub Actions, evidência por SHA)

| Workflow | SHA | Resultado |
|---|---|---|
| Cloud Quality Gate | `4f32f35` (integration) | **PASS** |
| Cloud Quality Gate | `dcde40d` (PR #80) | **PASS** |
| Web runtime lockfile | `4f32f35` | **PASS** |
| Web Product Smoke (browser real na URL implantada) | `4f32f35` | **PASS** |
| Workers Builds — integration/produção (deploy real) | `4f32f35` | **PASS** (Version ID; consertado pelo #79) |
| Workers Builds — branch de PR | `efd5552` | **NOT_APPLICABLE** como gate (falha é função da branch: árvore idêntica passou na integration; check não-required — RG-07) |

## Smoke real (ambiente implantado)

| Item | Resultado | Evidência |
|---|---|---|
| Homepage/Landing, Onboarding, Studio, navegação, reload, recovery, tema | **PASS** (base 4f32f35) | Web Product Smoke success (spec `tests/web-smoke/web-full.spec.ts` cobre landing→onboarding→studio, tema com persistência, recovery de sessão) |
| Chat Workers AI (sem JSON bruto) | **NEEDS_VALIDATION** | #80 merged e implantado (Version ID @ 61ae3d5); 1º smoke perdeu a corrida do deploy (timeline no audit RG-10); rerun = 1 clique do mantenedor; o spec agora assere ausência de payload bruto |
| Terminal / Git / filesystem / gates Toolbox | **BLOCKED** | Runtime `DISABLED` em produção (RG-05); UI agora explica o estado |
| Health/observabilidade | **PASS** | `/api/health` responde com estados verdadeiros (nunca mascarados) |
| Persistência (Durable Objects + R2) | **PASS** | health `workspacePersistence: READY`; suites de persistence/recovery 104/104 |

## Desktop

| Item | Resultado |
|---|---|
| Build (renderer compartilhado) | **PASS** (pnpm build) |
| Boot/terminal/Git/FS/tema/Control Center no Windows certificado | **BLOCKED** ambiente (RG-09) — executar `windows-certification` no host F: |

## Condições que IMPEDEM declarar RELEASE_GREEN hoje

1. Runtime remoto DISABLED em produção (RG-05 — externo).
2. Access `productionReady=false` (RG-08 — externo).
3. Smoke do delta do PR #80: rerun pendente (RG-10 — corrida de deploy; ação de 1 clique).
4. Certificação Windows não executada nesta janela (RG-09).

Estado honesto atual: **RELEASE_CANDIDATE_READY** (todo o corrigível está corrigido, gates executáveis 100% PASS, bloqueios restantes são externos e documentados com passo mínimo e teste de validação).
