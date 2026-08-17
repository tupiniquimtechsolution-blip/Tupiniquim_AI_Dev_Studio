# Changelog do Agente

## 2026-08-17 — Wave Mestre 1, retomada legada de efeitos

- Normalizada a leitura de plano e execução persistidos pelo schema atual, aplicando o valor padrão de `completedEffectIds` a registros anteriores à Wave 10.
- A conclusão de efeito usa a mesma normalização; integração cobre retomada de payload legado sem alterar nem remover dados existentes.

## 2026-08-17 — Wave Mestre 1, workspace.write aprovado

- Adicionado canal de execução tipado para `workspace.write`, separado do salvamento genérico: exige execução/passo/efeito aprovados, compara alvo e SHA-256 antes da escrita atômica e retorna somente metadados.
- Efeito é reservado em memória, concluído uma única vez na persistência e deixa evidência redigida no Flight Recorder e AuditLog. `.env*`, `DELETE`, terminal e Git mutável não são materializáveis por esse canal.
- E2E usa repositório Git temporário em D: e cobre hash/alvo divergentes, sucesso, repetição recusada e as fronteiras Electron existentes.

## 2026-08-17 — Wave Mestre 1, manifestos de efeitos

- Substituída a aprovação baseada em título genérico por manifesto canônico e tipado: capacidade, operação, alvo, risco e hash de payload, sem persistir o conteúdo do payload.
- Aprovação sem manifesto é recusada; mudanças de alvo ou efeito invalidam a decisão anterior. Atualizações do renderer não podem remover aprovação, reduzir risco, alterar estado ou modificar o manifesto após iniciar a execução.
- A interface passa a indicar manifestos pendentes e exibe os campos revisáveis de cada efeito antes da aprovação. Integração e E2E cobrem o vínculo e sua invalidação.

## 2026-08-17 — Wave Mestre 1, histórico recuperável

- Adicionada consulta IPC tipada de thread, turns e eventos persistidos, exibida na Caixa-preta sem conteúdo bruto de entrada.
- Adicionada migração SQLite v4 idempotente para criar tabelas de IA ausentes em bancos legados v3.
- Gate completo e E2E aprovados após validar a recuperação de histórico.

## 2026-08-17 — Wave Mestre 1, baseline de execução

- A execução aprovada passou a registrar evidências TOOL e GIT reais, somente leitura, no Flight Recorder e no painel.
- GitAdapter passou a aplicar safe.directory apenas ao processo do workspace, corrigindo o bloqueio de proprietário Windows sem tocar na configuração global.
- E2E valida aprovações, início de execução e as duas evidências; gates completos aprovados com 11 integrações.

## 2026-08-17 — Wave Mestre 1, contexto seguro do workspace

- Adicionado catálogo limitado e metadata-only do workspace ao IPC tipado, preload, painel e contexto dos providers.
- O contexto não lê conteúdo de arquivo, não inclui .env/itens ocultos/dependências e limita nomes a dados não confiáveis redigidos.
- Gates completos e E2E aprovados com 17 unitários, 9 integrações, 4 segurança e build.

## 2026-08-17 — Wave Mestre 1, runtime local Ollama

- Adicionado provider Ollama local-first com loopback HTTP estrito, modelos explícitos, NDJSON, cancelamento, erros explícitos e redaction.
- Integrados contrato, persistência hash-only, IPC tipado, preload mínimo e seletor do renderer; nenhum runtime, modelo ou serviço pago foi instalado.
- Validate e E2E passaram com 17 testes unitários, 8 integrações, 4 segurança, build e a troca visual de provider.

## 2026-08-17 — Wave Mestre 0 consolidada

- Corrigido o início ESM do Electron, o encerramento ConPTY e todos os caminhos ativos F: → D:.
- Consolidado o adapter Codex: handshake seguro, degradação de autenticação, streaming, interrupção, persistência de metadados e retomada de thread.
- Aplicados PolicyEngine e validação estrutural de outputs ao IPC; o E2E cobre os bloqueios de escrita e de comando destrutivo.
- Gate final aprovado: lint, typecheck, 11 testes unitários, 8 integrações, 4 de segurança, build e E2E.

## 2026-08-17 — Migração operacional para D:\CODEX

- Atualizada a raiz operacional desta máquina para `D:\CODEX\Tupiniquim-AI-Dev-Studio` e os dados para `D:\CODEX\Tupiniquim-AI-Dev-Studio.data`.
- Criados wrappers `bootstrap-d.ps1`, `pnpm-d.ps1` e `validate-d-drive.ps1`; o iniciador de desenvolvimento corrompido foi reparado.
- O histórico da migração anterior para F: foi preservado; o ADR 0011 passa a prevalecer nesta máquina.

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
