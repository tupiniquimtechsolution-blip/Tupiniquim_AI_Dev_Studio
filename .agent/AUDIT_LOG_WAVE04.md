# Audit Log — Consolidação da Onda 4

Data: 2026-08-13
Executor: Codex

Este ledger é append-only por rodada de auditoria. Ele registra somente evidências sanitizadas; valores de `.env*`, credenciais e tokens são proibidos.

## Rodada 2026-08-13 — auditoria antes da consolidação

### Evidências confirmadas por execução

- `git log --oneline --decorate -20` e `git tag --list` → `checkpoint/wave-00` a `checkpoint/wave-03` confirmados; `main` apontava para `2f77db6` antes da preservação WIP.
- `scripts\pnpm-f.ps1 lint` → aprovado.
- `scripts\pnpm-f.ps1 typecheck` → aprovado.
- `scripts\pnpm-f.ps1 test:unit` → 6 arquivos e 11 testes aprovados.
- `scripts\pnpm-f.ps1 test:security` → 3 arquivos e 4 testes aprovados.
- `scripts\pnpm-f.ps1 build` → build de main, preload e renderer aprovado.
- `scripts\pnpm-f.ps1 test:integration` → workspace, terminal, persistência e pesquisa aprovados; integração do Codex falhou ao acessar armazenamento criptografado de autenticação.
- `scripts\pnpm-f.ps1 test:e2e` → falhou antes da primeira janela com `__dirname is not defined`.
- Verificação silenciosa de presença → `OPENAI_API_KEY` existente; reutilização autorizada pelo usuário em 2026-08-13.

### Evidências encontradas em documentação

- `.agent\EXECUTION_PLAN.md` → Ondas 0–3 concluídas; Onda 4 em andamento; Ondas 5–12 pendentes.
- `.agent\adr\0005-codex-app-server.md` → stdio JSONL estável, schemas da versão instalada, WebSocket experimental e `thread/shellCommand` proibidos.
- `.agent\adr\0010-migracao-para-f-codex.md` → projeto, dados e toolchain controláveis em `F:\CODEX`.
- Documentação oficial do Codex App Server consultada em 2026-08-13 → handshake `initialize`/`initialized`, `account/read`, login condicional, `thread/start`, `thread/read` e `thread/resume` confirmados.

### Evidências inferidas e confirmadas por inspeção estática

- O registrador IPC validava input e auditava resultados, mas não aplicava `PolicyEngine` nem validava output.
- `LocalDatabase` continha tabelas preliminares das Ondas 5–9 e ainda não persistia threads, turnos e eventos da IA.
- Main, preload, contratos IPC e renderer misturavam superfícies das Ondas 4–10.
- `scripts\start-and-show-ip.ps1` continha caminhos corrompidos e não era adequado para checkpoint.

### Ainda não verificado nesta rodada

- Inferência live com conteúdo, bloqueada externamente por `OPENAI_API_NO_CREDITS`.
- Dogfood A–K e pacote Windows portátil, reservados às ondas finais.
- Aceite funcional das implementações preliminares das Ondas 5–10.

