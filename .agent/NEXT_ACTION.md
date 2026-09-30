# Next Action

Somente ações futuras reais (donos indicados):

1. FEITO: PR #80 merged (61ae3d5); deploy de produção verde (Version ID).
2. [Mantenedor — 1 clique] Re-run failed jobs no run 36762440741 do Web
   Product Smoke (o 1º run perdeu a corrida contra o deploy; o spec agora
   valida o parser). Alternativa: dispatch manual do workflow.
2b. [Mantenedor] Criar branch release/release-green-stabilization a partir
   da integration pós-merge para RG-05/RG-08/RG-09 (esta sessão é fixa na
   branch arena e não pode criar branches).
3. [Operador Cloudflare + host local] RG-05: habilitar Remote Runtime em
   produção seguindo docs/RELEASE/RUNBOOK.md §2; validar health READY e
   smoke de terminal/Git/filesystem/gates.
4. [Operador Cloudflare] RG-08: impor Cloudflare Access
   (docs/WEB/CLOUDFLARE_ACCESS.md); validar productionReady=true e smoke
   com WEB_SMOKE_REQUIRE_PRODUCTION_READY=true.
5. [Operador Cloudflare] RG-07: corrigir/limitar Workers Builds do dashboard
   para branches de PR.
6. [Host Windows F:] RG-09: executar certificação desktop
   (windows-certification) no ambiente alvo.
7. Após 1–6: declarar RELEASE_GREEN com a matriz de
   docs/RELEASE/RELEASE_GREEN_CHECKLIST.md 100% PASS/NOT_APPLICABLE.
