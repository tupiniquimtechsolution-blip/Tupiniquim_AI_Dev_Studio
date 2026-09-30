# Release Green Audit — inventário canônico

Atualizado em: 2026-09-30 · HEAD auditado: branch de estabilização sobre `integration/ai-lab-toolbox-unified` @ `4f32f35` (PR #80 aberto).
Metodologia: Agenor — *BUILD PASSOU ≠ PRODUTO FUNCIONA; CI GREEN ≠ RELEASE GREEN*. Toda linha tem evidência verificável.
Documentos irmãos: `RELEASE_GREEN_CHECKLIST.md` (matriz de gates), `KNOWN_LIMITATIONS.md`, `RUNBOOK.md`, `ROLLBACK.md`, além dos históricos `FINAL_RELEASE_AUDIT.md`/`RELEASE_GREEN_GATE_MATRIX.md` (waves anteriores — preservados).

## Inventário

| ID | Área | Problema | Evidência | Severidade | Causa-raiz | Impacto | Status | Dependência | Correção | Critério de aceite |
|---|---|---|---|---|---|---|---|---|---|---|
| RG-01 | Workers AI | Chat renderizava envelope JSON completo (`choices/usage/model`) | Reprodução em produção; payload OpenAI-compatible não tratado por `aiText()` | CRITICAL | BUG_CODE | Produto ilegível no chat | **FIXED** (PR #80 `ce637d5`) | — | `apps/web-runtime/src/ai-text.ts` compartilhado (worker.ts + worker-full.ts) | `tests/unit/web-ai-text.test.ts` (11 casos) PASS; smoke pós-merge |
| RG-02 | Workers AI / Segurança | `reasoning_content` podia vazar para a conversa via fallback `JSON.stringify` | Mesmo payload de RG-01 | HIGH | SECURITY | Vazamento de raciocínio interno do modelo | **FIXED** (PR #80) | — | OpenAI-shaped sem texto ⇒ `''`, nunca objeto bruto | Teste assere ausência de `reasoning_content`/`usage`/`model` |
| RG-03 | Toolbox | Todos os gates falhavam com a MESMA mensagem genérica, sem executar | `full.control.gate` retornava um único texto para 3 estados distintos | MEDIUM | UX | Sensação de produto quebrado | **FIXED** (PR #80 `bd3450c`) | — | `gateLockReason()` puro: DISABLED/MISCONFIGURED/OFFLINE distintos; código `REMOTE_RUNTIME_OFFLINE` mantido | `tests/unit/web-remote-runtime.test.ts` PASS; OFFLINE ≠ FAIL de gate |
| RG-04 | Terminal/Git/FS | Drawer bloqueado sem explicação; sensação de loop para Toolbox | UI mostrava só o lock genérico | MEDIUM | UX | Usuário sem caminho de ação | **FIXED** (PR #80 `dcde40d`) | — | Drawer mostra estado real + "Verificar novamente" (re-consulta `/api/health`, libera sem reload) + "Abrir Control Center"; Control Center bloqueia gates ANTES do clique com status sanitizado | Smoke manual + unit de mensagens por estado |
| RG-05 | Remote Runtime | Produção com `executionRuntime.state=DISABLED` | `GET /api/health` real (2×, 2026-09-30) | CRITICAL p/ escopo full | CONFIG_MISSING / EXTERNAL_DEPENDENCY | Terminal/Git/FS/gates indisponíveis na Web (fail-closed correto) | **BLOCKED_EXTERNAL** | Operador da conta Cloudflare + host local | Ver `RUNBOOK.md` §Runtime Local: `WEB_REMOTE_RUNTIME_ENABLED=true`, `REMOTE_RUNTIME_URL`, secret `REMOTE_RUNTIME_TOKEN`, tunnel + gateway ativos | `/api/health` → `READY` com capabilities; smoke terminal/Git/FS/gate PASS |
| RG-06 | Testes/Ambiente | "22 falhas integration + 1 security pré-existentes (unidade F:)" carregadas por várias sessões | Reexecução com `TEMP=/tmp`: integration **104/104 PASS**, security **55/55 PASS**; CI ubuntu sempre passou (`cloud-quality` success em dbfb175/51c1818/4f32f35/dcde40d) | HIGH (era ruído de auditoria) | ENVIRONMENT (invocação local sem TEMP) — NÃO era bug de produto nem teste mal desenhado | Falso sinal de vermelho eterno | **FIXED** | — | Mensagem do guard esclarecida (`persistence.test.ts`): fora do Windows pede TEMP; em win32 mantém contrato F:\ | Suites PASS com TEMP definido; contrato F: preservado p/ certificação Windows |
| RG-07 | CI/CD externo | Check "Workers Builds: tupiniquim-dev-ai-web" FAIL no PR #80 | `gh pr checks 80` (build do dashboard Cloudflare para branch de PR) | MEDIUM | CI_CD / EXTERNAL_DEPENDENCY | `mergeState=UNSTABLE` (não bloqueia cloud-quality, que está PASS) | **BLOCKED_EXTERNAL** | Config Workers Builds no dashboard Cloudflare (sem acesso pela sessão) | Restringir builds a branch de produção ou corrigir comando de build de preview no dashboard | Check verde ou desabilitado para branches de PR |
| RG-08 | Segurança/Acesso | `auth.state=ANONYMOUS_TEST`, `productionReady=false` em produção | `/api/health` real | HIGH p/ produção pública | CONFIG_MISSING / EXTERNAL_DEPENDENCY | Superfície sem Cloudflare Access | **BLOCKED_EXTERNAL** | Operador Cloudflare (Access) | `docs/WEB/CLOUDFLARE_ACCESS.md` (já documentado) | Health `productionReady=true`; smoke com `WEB_SMOKE_REQUIRE_PRODUCTION_READY=true` |
| RG-09 | Desktop | Electron não executável no sandbox Linux desta sessão | `pnpm dev`/e2e exigem display+Windows cert (host F:) | MEDIUM | ENVIRONMENT | Certificação desktop não reproduzível aqui | **BLOCKED_ENVIRONMENT** | Host Windows certificado (workflows `windows-certification`, `ci.yml`) | — | e2e desktop PASS no host alvo |
| RG-10 | Web smoke real | Smoke de browser em ambiente implantado | Workflow **Web Product Smoke: success @ 4f32f35** (base atual); falha isolada em 51c1818 foi sucedida por sucesso em 4f32f35 | — | — | — | **ALREADY_GREEN** (base) / **NEEDS_VALIDATION** para o delta do PR #80 (dispara no push pós-merge) | Merge do #80 | — | Web Product Smoke success no SHA de merge |
| RG-11 | Web/UI | Tema claro/escuro/system + transições | Merged em `51c1818`; smoke (inclui teste de tema) success em `4f32f35` | — | — | — | **ALREADY_GREEN** | — | — | — |
| RG-12 | Toolchain Cloudflare | Sandbox/Containers removidos; Wrangler 4.144.0 pinado; action por SHA | PR #79 merged (`4f32f35`); `tests/unit/cloudflare-toolchain.test.ts` 11/11 | — | — | — | **ALREADY_GREEN** | — | — | — |
| RG-13 | Testes condicionais | 4 testes skipped (codex-app-server×2, research×1, terminal×1) | Skips condicionais por binário/rede/pty indisponíveis | INFO | ENVIRONMENT | — | **NOT_APPLICABLE** neste ambiente (executam onde a dependência existe) | — | — | Executar no host de certificação |
| RG-14 | Código | Varredura TODO/FIXME/HACK/stub/not-implemented | Únicos hits reais: `WEB_ACTION_NOT_IMPLEMENTED` (501 fail-closed intencional p/ ações não mapeadas); demais são falso-positivo linguístico ("TODO"=todo em PT) | — | — | — | **ALREADY_GREEN** | — | — | — |
| RG-15 | Ambiente local | Sandbox usa Node 22 (engines pedem ≥24) | Warning pnpm; CI usa Node 24 | INFO | ENVIRONMENT | Nenhum (CI correto) | **ALREADY_GREEN** | — | — | — |
| RG-16 | Persistência | Durable Objects + backup R2 | `workspacePersistence: READY/configured` no health real; suites persistence 104/104 (inclui recovery/restart SQLite) | — | — | — | **ALREADY_GREEN** | — | — | — |

## Classificação agregada

- **FIXED nesta onda:** RG-01, RG-02, RG-03, RG-04, RG-06.
- **ALREADY_GREEN:** RG-10(base), RG-11, RG-12, RG-14, RG-15, RG-16.
- **BLOCKED_EXTERNAL:** RG-05 (runtime vars/secret/tunnel), RG-07 (Workers Builds dashboard), RG-08 (Cloudflare Access).
- **BLOCKED_ENVIRONMENT:** RG-09 (certificação Windows/Electron).
- **NEEDS_VALIDATION:** RG-10 (smoke do delta #80 pós-merge).
- **NOT_APPLICABLE (justificado):** RG-13.

## Caminho determinístico para RELEASE_GREEN

1. Merge do PR #80 (cloud-quality PASS; único check vermelho é externo — RG-07).
2. Web Product Smoke verde no SHA de merge (automático no push).
3. RG-05: executar RUNBOOK §Runtime Local → health READY → smoke terminal/Git/FS/gates.
4. RG-08: ativar Access → health `productionReady=true` → smoke com produção exigida.
5. RG-09: rodar certificação Windows no host F:.
6. Declarar RELEASE_GREEN com a matriz de `RELEASE_GREEN_CHECKLIST.md` 100% PASS/NOT_APPLICABLE.
