# Current Task

Atualizado: 2026-10-16. Fonte de verdade: GitHub.

## Produto Web — HUD chat-first

- PR #85 **MERGED** em `integration/ai-lab-toolbox-unified` no SHA `e3bec44710ac34f41f135ea2b1b0466ae701806e`.
- Cloud Quality Gate do PR: **SUCCESS**.
- Deploy Workers Build: **SUCCESS** — Build ID `26c99bb7-765f-4116-8e35-fb84f0624636`, Version ID `8a97095a-8a67-4821-b5c9-1dee5bcdd0d0`.
- Web Product Smoke `38883721480`, attempt 2: **SUCCESS**, 5 passed / 1 skipped.
- Inclui regressão de menus de ferramentas/modos, tema, navegação, chat real Workers AI e recovery.
- Capturas visuais por viewport (390/768/1024/1440) e auditoria de overflow em cloud CI: PR de evidência em andamento; não atribuir PASS antes de rodar.

## Release Green global — gates restantes

- RG-05 / Issue #68: Remote Runtime físico + Cloudflare Tunnel + secret + configuração e certificação de filesystem/Git/terminal/build/checkpoint/fail-closed.
- RG-08: Cloudflare Access production-ready e smoke com `WEB_SMOKE_REQUIRE_PRODUCTION_READY=true`.
- RG-09: Windows/Electron com host físico F: — testes locais fora do escopo desta etapa.
- RG-07: política de builds de branches de PR no Cloudflare Dashboard (operacional; não é regressão de código).

O smoke com 1 skipped é **CLOUD-ONLY GREEN**, não `RELEASE_GREEN` completo.

## Referências

- `docs/RELEASE/RELEASE_GREEN_AUDIT.md`
- `docs/RELEASE/RELEASE_GREEN_CHECKLIST.md`
- `docs/WEB/HUD_UX_REVIEW.md`
- `docs/WEB/CLOUDFLARE_TOOLCHAIN.md`
- `docs/RELEASE/RUNBOOK.md`
