# Status

Atualizado em: 2026-08-17

## Estado atual

- Current wave: Wave 0 do Plano Mestre — concluída, checkpoint em preparação.
- Current checkpoint: checkpoint/wave-03 (2f77db6); o próximo será checkpoint/wave-04.
- Current branch: codex/wip-waves-04-10-20260813.
- HEAD base: 66f94a7618b3aee4288e1cd28f9461d9fed4a589.
- Repositório operacional: D:\CODEX\Tupiniquim-AI-Dev-Studio.
- Dados: D:\CODEX\Tupiniquim-AI-Dev-Studio.data.
- Toolchain: D:\CODEX\programas.

## Concluído na Wave 0

- Migração operacional F: → D: com ADR 0011, scripts D:, validação de localização e reparo do iniciador corrompido.
- Correção do início Electron ESM por fileURLToPath; a janela real abre no E2E.
- CodexAppServerAdapter com handshake, autenticação degradável sem segredo, JSONL controlado, streaming, interrupção, encerramento e thread/resume.
- Persistência SQLite de threads, turns (somente hash da entrada) e eventos normalizados.
- PolicyEngine aplicado no registrador IPC; comandos absolutamente bloqueados e operações que exigem aprovação são recusados antes do adapter.
- Respostas IPC são verificadas como dados serializáveis antes de cruzar o preload.
- Encerramento de ConPTY aguarda a saída do processo, eliminando a corrida de limpeza.

## Gates atuais

    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pnpm-d.ps1 validate
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pnpm-d.ps1 test:e2e

- validate: PASS — validação D:, lint, typecheck, 11 unitários, 8 integrações (2 opt-in ignorados), 4 testes de segurança e build.
- test:e2e: PASS — Electron real, bridge preload, sandbox, política de escrita e bloqueio de git reset --hard.

## Próximo

Iniciar Wave 1: separar o contrato de provider do Codex e avaliar o runtime Ollama local sem instalar modelos ou serviços pagos automaticamente.

## Bloqueios externos

- OPENAI_API_NO_CREDITS bloqueia somente inferência live paga; não invalida o transporte controlado.
- Provedores visuais pagos permanecem NOT_CONFIGURED.
