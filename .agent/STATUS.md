# Status

Atualizado em: 2026-08-12

## Estado atual

- Sprint: Mestre único
- Ondas concluídas: 0–3
- Próxima onda: 4 — AIProvider e Codex App Server
- Estado: ONDAS 1–3 VALIDADAS; CHECKPOINT EM PREPARAÇÃO
- Repositório alvo: `F:\CODEX\Tupiniquim-AI-Dev-Studio`
- Dados: `F:\CODEX\Tupiniquim-AI-Dev-Studio.data`
- Toolchain no SSD: Node.js `F:\CODEX\programas\nodejs`; pnpm/Corepack `F:\CODEX\programas`; SDK .NET/Visual Basic `F:\CODEX\programas\dotnet`.

## Entregue

- Fundação Electron/React/TypeScript com sandbox, isolamento de contexto, CSP e preload mínimo.
- HUD desktop inicial em português, com Monaco, árvore de arquivos, painel agêntico e área inferior operacional.
- Contratos IPC Zod validados nos dois lados e auditoria JSONL redigida.
- Workspace real: configuração, árvore, leitura, busca e escrita atômica com hash otimista.
- Proteções contra traversal, fuga por symlink e arquivos acima do limite.
- Git real: status porcelain v2 e diff.
- Terminal real multiprocessos com `node-pty`/ConPTY, resize, entrada, encerramento e timeout.
- Bootstrap, toolchain, store, cache, temporários, dados, logs, builds e testes direcionados a `F:\CODEX`.

## Evidência da última validação

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pnpm-f.ps1 validate
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pnpm-f.ps1 test:e2e
```

Resultado anterior à migração: regra de disco, lint, typecheck, 5 testes unitários, 3 de integração, 2 de segurança, build Electron e 1 cenário E2E aprovados. O E2E abriu a aplicação real, acessou o workspace pela ponte preload e confirmou `nodeIntegration=false`, `contextIsolation=true` e `sandbox=true`.

## Migração para F:\CODEX

- `scripts\bootstrap-f.ps1` recriou 457 pacotes em `F:\CODEX` usando pnpm 11.16.0 e concluiu o pós-install nativo de `node-pty`.
- `scripts\validate-f-drive.ps1` aprovou a raiz, os componentes locais e a ausência de diretórios de dados padrão do aplicativo fora do SSD.
- O gate completo chegou ao lint e parou em 19 erros pertencentes às mudanças funcionais já abertas da onda 4; a migração de disco não introduziu erro de lint identificado.

## Próximo

1. Gerar e versionar os schemas estáveis da versão instalada do Codex App Server.
2. Implementar `AIProvider` e adapter stdio JSONL com inicialização, autenticação, threads, streaming e cancelamento.
3. Persistir histórico e eventos normalizados sem registrar segredos.
4. Conectar a UI ao provider real e validar retomada/erros.

## Bloqueios externos

- `OPENAI_API_NO_CREDITS`: handshake, login por API key, thread, turno, streaming de eventos, retries e erro final foram exercitados contra o Codex App Server real. A inferência não retornou conteúdo porque o projeto OpenAI selecionado não possui créditos. As demais ondas continuam; o aceite live final exige adicionar créditos.
- Provedores visuais pagos permanecem `NOT_CONFIGURED`, conforme planejado.
