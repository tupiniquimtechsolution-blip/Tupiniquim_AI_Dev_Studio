# Changelog do Agente

## 2026-08-12 — Migração do workspace para F:\CODEX

- Tornada oficial a raiz `F:\CODEX\Tupiniquim-AI-Dev-Studio` e a raiz de dados `F:\CODEX\Tupiniquim-AI-Dev-Studio.data`.
- Substituídos os wrappers do disco anterior por bootstrap, pnpm e validação orientados ao SSD F.
- Integrados Node.js 24.19.0, pnpm 11.16.0 e SDK .NET 10.0.400/compilador Visual Basic instalados em `F:\CODEX\programas`.
- Dependências reinstaladas no SSD com o lockfile preservado; validação de localização aprovada.

## 2026-08-11 — Ondas 1–3

- Criado monorepo pnpm com versões exatas, lockfile e bootstrap de disco dedicado.
- Implementados main, preload e renderer Electron com fronteiras seguras e IPC validado.
- Criado HUD Carbono/Floresta com Monaco, xterm, painéis operacionais e i18n PT-BR inicial.
- Implementados Workspace Engine, Git adapter, ConPTY real, logs redigidos e políticas de comando.
- Adicionados testes unitários, integração, segurança e E2E desktop.
- Corrigidos externalização do Electron/node-pty, formato CJS do preload sandboxed e tipagem da inspeção E2E.
- Validado o aplicativo real com workspace, Git, terminal e preferências de segurança.

## 2026-08-11 — Onda 0

- Auditado ambiente Windows e isolamento entre projetos.
- Definido originalmente um repositório isolado em disco dedicado; localização substituída pelo ADR 0010.
- Concluídas pesquisas técnica e visual.
- Criada chave de API pelo fluxo seguro; arquivo local permanece ignorado.
- Criada documentação durável, critérios de aceite, pesquisas e nove ADRs.
- Validada a regra de disco dedicado e criado o checkpoint `wave-00`.
