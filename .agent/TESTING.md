# Estratégia de Testes

## Camadas

- Unitário: contratos, políticas, state machine, prompts, resolver e sanitização.
- Integração: filesystem em fixture, Git temporário, SQLite, subprocessos, app-server falso por JSONL e HTTP local.
- Segurança: traversal, junction/symlink, IPC inválido, command injection, aprovação reaproveitada, prompt injection e secret redaction.
- E2E: Electron real, preload, HUD, workspace, terminal, plano, preview e persistência.
- Dogfood: cenários A–K do Prompt Mestre em WEB, DESKTOP e MOBILE.

## Comandos de aceite

```powershell
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm test:security
pnpm test:dogfood
pnpm build
pnpm package:win
pnpm validate
```

`pnpm validate` agrega verificações estáticas, testes sem credenciais pagas e build. Testes que exigem serviços externos são opt-in e devem reportar `NOT_CONFIGURED`, não sucesso falso.

