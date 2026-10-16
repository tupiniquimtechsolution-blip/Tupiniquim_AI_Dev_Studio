# Next Action

Atualizado: 2026-10-16.

1. [Cloud CI] Concluir PR `test/web-hud-responsive-evidence` e registrar screenshots 390/768/1024/1440 + resultado de overflow. Nenhum teste local exigido nesta frente.
2. [Operador Cloudflare + host Windows] Issue #68 / RG-05: ativar named Tunnel + Runtime Gateway real, configurar `WEB_REMOTE_RUNTIME_ENABLED`, `REMOTE_RUNTIME_URL`, `REMOTE_RUNTIME_TOKEN` como secret; rodar smoke full com capacidades de SO.
3. [Operador Cloudflare] RG-08: configurar Cloudflare Access real, comprovar `auth.productionReady=true` e smoke `WEB_SMOKE_REQUIRE_PRODUCTION_READY=true`. Não declarar pronto no modo `ANONYMOUS_TEST`.
4. [Operador Cloudflare] RG-07: limitar Workers Builds do dashboard a branch de produção, evitando check vermelho artificial em PRs.
5. [Host Windows F:] RG-09: certificar Electron/ConPTY/Git/FS no equipamento alvo, etapa física explicitamente diferida.
6. [Auditor] Revisar `docs/RELEASE/RELEASE_GREEN_CHECKLIST.md` com SHA/build/run e marcar `RELEASE_GREEN` somente quando todos os gates obrigatórios estiverem PASS ou NOT_APPLICABLE com justificativa comprovada.

Concluído (não repetir): PR #79 toolchain Cloudflare; PR #80 parser Workers AI e estados Runtime; PR #85 HUD simplificado. Live Web smoke pós-PR #80 reexecutado com SUCCESS em 16/10/2026 (workflow `36762440741`, 4 passed / 1 skipped). Smoke do HUD (workflow `38883721480`, attempt 2) SUCCESS, 5 passed / 1 skipped.
