# Next Action

Somente ações futuras reais (donos indicados):

1. [Mantenedor] Revisar e mergear PR #80 (cloud-quality PASS; único check
   vermelho é o Workers Builds externo do dashboard — RG-07).
2. [Automático] Confirmar Web Product Smoke verde no SHA de merge.
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
