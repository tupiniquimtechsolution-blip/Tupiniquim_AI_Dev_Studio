# Release Green Checklist — matriz de gates

## Atualização certificada — 2026-10-16

Esta seção prevalece sobre os itens históricos de 2026-09-30 abaixo.

| Gate | Estado | Evidência |
| --- | --- | --- |
| Cloudflare toolchain | PASS | PR #79, Wrangler 4.144.0 pinado, dry-runs MW0–MW5 |
| Parser Workers AI / estados Runtime | PASS código | PR #80 merged, integration merge `61ae3d59152649409a8dfe18d4c8dd7ee01be6f6` |
| Live Web após PR #80 | PASS cloud-only | Workflow `36762440741`, attempt 2: 4 passed / 1 skipped |
| HUD chat-first | PASS código/CI | PR #85 merged em `e3bec44710ac34f41f135ea2b1b0466ae701806e`; Cloud Quality SUCCESS |
| Cloudflare Web deploy | PASS | Build `26c99bb7-765f-4116-8e35-fb84f0624636`, Version ID `8a97095a-8a67-4821-b5c9-1dee5bcdd0d0` |
| Live Web após PR #85 | PASS cloud-only | Workflow `38883721480`, attempt 2: 5 passed / 1 skipped (inclui HUD/tema/chat/recovery) |
| Responsividade com evidência visual | IN_PROGRESS | branch `test/web-hud-responsive-evidence` — screenshots e overflow em 390/768/1024/1440 serão gerados no CI |
| RG-05 Remote Runtime | BLOCKED | Issue #68 — gateway/tunnel/secret/READY não certificados |
| RG-08 Access | BLOCKED | Production Access e production-ready smoke não certificados |
| RG-09 Windows físico | BLOCKED_ENVIRONMENT | Dependência do host certificado F: (fora dos testes locais desta tarefa) |

**Classificação:** WEB CLOUD-ONLY GREEN. **Não** declarar `RELEASE_GREEN` completo enquanto RG-05/RG-08/RG-09 estiverem pendentes. Um teste skipped por Runtime OFFLINE não é PASS da capacidade.

---

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
| Chat Workers AI (sem JSON bruto) | **NEEDS_VALIDATION → smoke pós-merge do #80** | Correção está no PR; smoke dispara no push da integration |
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
3. Smoke do delta do PR #80 ainda não rodou (roda no merge).
4. Certificação Windows não executada nesta janela (RG-09).

Estado honesto atual: **RELEASE_CANDIDATE_READY** (todo o corrigível está corrigido, gates executáveis 100% PASS, bloqueios restantes são externos e documentados com passo mínimo e teste de validação).
