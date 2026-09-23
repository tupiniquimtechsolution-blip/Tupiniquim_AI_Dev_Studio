# 0.1.0-rc.1 — integração de 2026-09-22

- Merge controlado de origin/main eb93c35 na branch fixa Arena, preservando ancestry de be33b64, sem rebase/force push/main merge.
- Google Tasks OAuth/dock preservados junto da fronteira Codex, provider fail-closed e recovery Wave17.
- Corrigido entrypoint pós-merge: bootstrap Google Tasks agora emite out/main/index.js, caminho esperado pelo Electron/package.json.
- Monaco e workers empacotados localmente, sem CDN incompatível com CSP/offline.
- Escolha explícita de provider/modelo persistida atomicamente fora de qualquer credencial; startup restaura escolha e lista modelos.
- Ollama atualiza todos os modelos em /api/tags, remove lista stale em indisponibilidade e permite atualização manual.
- Rail de navegação ligado aos modos; Review mostra git diff real; Testes indisponível é desabilitado com motivo.
- Escrita manual, prompt e research podem obter autorização one-shot em diálogo nativo. Sem bypass da política nem flags de aprovação do renderer.
- Terminal exibe erros de política e encerra sessão no unmount (não deixa PTY órfão ao trocar abas).
- Setup/build/run/verify Windows centralizados; manifesto required/recommended/optional; releases em release/.
- Suíte Google Tasks antes não descoberta agora incluída em unit. Fixtures portáveis para SQLite/licença; gates Windows reportados como skipped, não falsos passes.

Aceite V1 permanece pendente. Consulte KNOWN_ISSUES.md e EVIDENCE.md.
