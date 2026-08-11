# Status

Atualizado em: 2026-08-11

## Estado atual

- Sprint: Mestre único
- Ondas concluídas: 0–3
- Próxima onda: 4 — AIProvider e Codex App Server
- Estado: ONDAS 1–3 VALIDADAS; CHECKPOINT EM PREPARAÇÃO
- Repositório alvo: `E:\Tupiniquim-AI-Dev-Studio`
- Dados: `E:\Tupiniquim-AI-Dev-Studio.data`

## Entregue

- Fundação Electron/React/TypeScript com sandbox, isolamento de contexto, CSP e preload mínimo.
- HUD desktop inicial em português, com Monaco, árvore de arquivos, painel agêntico e área inferior operacional.
- Contratos IPC Zod validados nos dois lados e auditoria JSONL redigida.
- Workspace real: configuração, árvore, leitura, busca e escrita atômica com hash otimista.
- Proteções contra traversal, fuga por symlink e arquivos acima do limite.
- Git real: status porcelain v2 e diff.
- Terminal real multiprocessos com `node-pty`/ConPTY, resize, entrada, encerramento e timeout.
- Bootstrap, store, cache, temporários, dados, logs, builds e testes direcionados ao disco E.

## Evidência da última validação

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pnpm-e.ps1 validate
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pnpm-e.ps1 test:e2e
```

Resultado: regra E-only, lint, typecheck, 5 testes unitários, 3 de integração, 2 de segurança, build Electron e 1 cenário E2E aprovados. O E2E abriu a aplicação real, acessou o workspace pela ponte preload e confirmou `nodeIntegration=false`, `contextIsolation=true` e `sandbox=true`.

## Próximo

1. Gerar e versionar os schemas estáveis da versão instalada do Codex App Server.
2. Implementar `AIProvider` e adapter stdio JSONL com inicialização, autenticação, threads, streaming e cancelamento.
3. Persistir histórico e eventos normalizados sem registrar segredos.
4. Conectar a UI ao provider real e validar retomada/erros.

## Bloqueios

Nenhum. Provedores visuais pagos permanecem `NOT_CONFIGURED`, conforme planejado.
