# Known Limitations

Atualizado em: 2026-09-30.

1. **Remote Runtime desativado por padrão em produção** (`WEB_REMOTE_RUNTIME_ENABLED=false`). Terminal, Git, filesystem e gates do Toolbox ficam fail-closed na Web até o operador ativar a integração (RUNBOOK §Runtime Local). A UI explica o estado (DISABLED/MISCONFIGURED/OFFLINE) em vez de falhar genericamente.
2. **Acesso anônimo de teste** (`auth.state=ANONYMOUS_TEST`): Cloudflare Access ainda não imposto na conta — produção pública não deve ser anunciada antes disso (`docs/WEB/CLOUDFLARE_ACCESS.md`).
3. **Gates do Toolbox executam somente no hardware do usuário** via Remote Runtime (decisão de arquitetura zero-cost; nunca no Worker).
4. **Terminal (xterm) e superfícies de evidência técnica permanecem escuras** nos dois temas (decisão de design documentada em `.agent/DESIGN_SYSTEM.md`).
5. **Certificação Desktop/Windows** exige host com unidade `F:` (contrato de TEMP em win32) — testes portáveis em outros SOs com `TEMP` definido.
6. **Workers Builds (dashboard)**: na integration é o deploy de produção (verde desde o #79, com Version ID); em branches de PR falha sistematicamente por configuração de branch (evidência: árvore idêntica verde na integration) — check não-required, NOT_APPLICABLE como gate; o dono do dashboard pode desabilitar builds de branches não-produção (Settings → Builds → Branch control).
7. **Codex App Server / Ollama**: testes condicionais só executam onde binário/serviço existem (skips documentados, nunca PASS falso).
8. **`WEB_ACTION_NOT_IMPLEMENTED` (HTTP 501)**: ações RPC não mapeadas na Web falham fechado por design — não é stub esquecido.
