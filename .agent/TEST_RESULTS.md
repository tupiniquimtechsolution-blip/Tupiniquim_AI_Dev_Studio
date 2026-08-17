# Resultados de testes

## 2026-08-17 — Wave 0, antes do checkpoint

| Comando | Resultado |
|---|---|
| scripts\validate-d-drive.ps1 | PASS |
| scripts\pnpm-d.ps1 validate | PASS: lint, typecheck, 11 unitários, 8 integrações (2 opt-in ignorados), 4 segurança e build |
| scripts\pnpm-d.ps1 test:e2e | PASS: 1 cenário Electron real |

## Evidência funcional adicional

- O transporte JSONL controlado verificou criação, streaming, interrupção, persistência sanitizada e retomada de thread.
- O E2E verificou que escrita de workspace sem aprovação retorna APPROVAL_REQUIRED e que git reset --hard é bloqueado por política.
- Inferência live OpenAI continua opt-in e pode retornar OPENAI_API_NO_CREDITS; não foi usada como evidência de sucesso.
