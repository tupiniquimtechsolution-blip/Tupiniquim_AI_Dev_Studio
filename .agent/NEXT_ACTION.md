# Próxima ação

Master Wave: **1 (EM ANDAMENTO)**.

Wave 16: **FECHADA** com `checkpoint/wave-16` confirmado no commit `0b46bd60996aa6f87e495cffa8c4ff1bc4d1c0e8`.

Wave 17: **DOGFOOD/QA FINAL ATIVO** — Issue #24.

## Agora

Na máquina Windows F:, sincronizar a branch:

`wave-17/master-wave-1-dogfood-qa`

Registrar antes de qualquer execução:

```powershell
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/wave-17/master-wave-1-dogfood-qa
```

Depois executar os gates automatizados no mesmo HEAD:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\pnpm-f.ps1" validate
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\pnpm-f.ps1" test:e2e
```

Se ambos estiverem GREEN, executar o dogfood manual integrado definido na Issue #24:

1. startup/workspace real;
2. conversa/sessão;
3. multi-provider explícito;
4. restart/recovery;
5. workspace A → B → A;
6. proposal/EXPIRED;
7. privacidade/persistência;
8. UX/estado.

## Regra de achados

Não corrigir silenciosamente durante a coleta.

Classificar cada achado como:

- PRODUCTION BUG
- E2E/HARNESS BUG
- UX BUG
- DOCUMENTATION GAP
- ENVIRONMENT
- OUT OF SCOPE

Para bloqueios reais, registrar reprodução e somente depois criar correção mínima com testes e nova auditoria.

## Condição de fechamento

A Master Wave 1 só pode ser encerrada depois que a Issue #24 estiver GREEN, sem bloqueios críticos/altos abertos, com gates Windows F: aprovados e documentação final auditada.

Master Wave 2 permanece **NÃO INICIADA** até esse fechamento.
