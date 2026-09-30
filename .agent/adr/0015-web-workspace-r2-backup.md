# ADR 0015 — Persistência Web de /workspace via Sandbox backup/restore + R2

Status: PROPOSTA IMPLEMENTADA / ATIVAÇÃO CLOUD PENDENTE  
Data: 2026-09-28

## Decisão

Persistir o workspace Web usando `createBackup()` / `restoreBackup()` do Cloudflare Sandbox SDK, com objetos em R2 e o handle mais recente em `WebState`.

Não montar R2 diretamente sobre `/workspace`.

## Razões

- preserva o filesystem normal do Sandbox durante execução;
- evita overlay permanente sobre `/workspace`;
- permite restauração após sleep/restart;
- mantém estado lógico (DO) separado de arquivos duráveis (R2);
- permite readiness `DISABLED/MISCONFIGURED/READY` sem PASS fictício.

## Segurança

- credenciais R2 somente em secrets;
- nenhum secret em Git, logs, health ou estado lógico;
- isolamento por `workspaceId`;
- backup só é ativado explicitamente;
- configuração incompleta é `MISCONFIGURED`.

## Consequências

- produção requer bucket + account id + R2 API credentials;
- o deploy atual continua bloqueado antes disso por Containers `/containers/me` (Issue #53);
- alterações arbitrárias via terminal exigem checkpoint explícito neste slice;
- release Web exige smoke de restore real antes de declarar persistência PASS.
