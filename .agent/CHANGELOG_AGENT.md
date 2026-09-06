# Changelog do Agente

## 2026-09-06 — Wave 14 — fechamento documental do checkpoint (docs-only) — HEAD 2703ed5

Alteração exclusivamente de documentação em `.agent/`. Nenhum `.ts`, `.tsx`, `.js`,
`package`, config ou teste foi alterado.

### Estado do checkpoint

- Master Wave 1 continua **EM ANDAMENTO** (ver `.agent/MASTER_PLAN.md`).
- checkpoint wave-14: **APROVADO/FECHADO**; NÃO é uma nova Master Wave.
- Branch correta: `arena/01a06dcc-tupiniquim-ai-dev-studio`.
- PR correto: #15.
- Issue: #11.
- HEAD validado no Windows F: `2703ed5cef0188e9b9e548bcdca84a7d7328c6e0`.

### Gates Windows F: reais

- `pnpm-f.ps1 validate`: PASS integral.
- `pnpm test:unit`: 52/52 PASS.
- `pnpm test:integration`: 42 passed / 2 skipped.
- `tests/integration/persistence.test.ts`: 22/22 PASS.
- `pnpm test:security`: 34/34 PASS.
- `pnpm build`: PASS.
- `pnpm-f.ps1 test:e2e`: 2/2 PASS, executado **duas vezes**.

Status `BLOCKED` referente a Windows F:, persistence e E2E foi removido da
documentação: as execuções reais na máquina Windows resolveram esses itens.

### Fluxo final comprovado

- provider-neutral tool protocol
- proposal provenance
- EXPIRED
- replacement A→B
- mesma Execution/Step/Thread
- Turn/ToolCall distintos
- `apply(A)` recusado
- arquivo A ausente
- payload privado ausente de: DOM, conversation, agent history, Flight Recorder, AuditLog e SQLite
- isolamento entre workspaces
- baseline fail-closed
- purge do payload efêmero

### Preservado

Terminal mutável continua **INDISPONÍVEL**; Git mutável continua **INDISPONÍVEL**.
Nenhum merge realizado. `NEXT_ACTION.md` volta a apontar para
`.agent/MASTER_PLAN.md` para definir a próxima unidade da Master Wave 1.

## 2026-09-04 — Wave 14 (Master Wave 1, checkpoint candidate wave-14), correções da 4ª auditoria — HEAD 312c674

Continuidade corretiva sobre o PR #12 (Ref #11). Nenhuma mudança arquitetural; os elementos já aprovados foram preservados (NormalizedToolCallEnvelope, workspaceWriteArgsSchema strict, protocolo provider-neutral, proposeFromEnvelope(), WorkspaceBaselineLookup via DI, WorkspaceAdapter.inspectWriteTarget(), ProposalStatus com EXPIRED, lookupProposalStatus IPC, tombstone público, validação do adapter Ollama, PolicyEngine, ApprovalStore/PlanApprovalService, AuditLog, payload privado somente em memória; Terminal e Git mutáveis seguem indisponíveis).

### Correção 1 — baseline FAIL CLOSED (bloqueante)
- Removido o `catch` genérico de `lookupTargetBaseline()` no `WorkspaceWriteProposalService`, que convertia QUALQUER exceção em `{ exists:false, hash:null }` (fail-open).
- Agora erros de inspeção/path do `WorkspaceAdapter.inspectWriteTarget()` — path traversal, caminho absoluto, symlink fora do workspace, namespace/dispositivo inválido, permissão ou erro inesperado — PROPAGAM e recusam a proposta.
- Apenas um resultado real `{ exists:false, hash:null }` do adapter significa alvo inexistente. Drift de workspace na inspeção também falha com erro explícito.

### Correção 2 — purge garantido no EXPIRED
- `lookupStatus()` agora chama `invalidate(id)` também no caminho de exceção de `validateProposalState()`.
- Declarar EXPIRED nunca mais deixa o payload efêmero residente em memória; segunda consulta continua EXPIRED e `consume()` falha.

### Correção 3 — testes de persistência sem falso cenário
- Teste de workspace drift reescrito para usar a MESMA instância do serviço com `getWorkspaceRoot()` mutável (antes criava uma instância nova vazia, que retornaria EXPIRED para qualquer id).
- Teste de purge reescrito para provocar expiração REAL (drift causal) antes de lookup/consume; cobre lookupStatus=EXPIRED, segunda consulta EXPIRED, consume rejeitado e payload não recuperável/não persistido.

### Testes novos cross-platform (executados no Linux/Arena, sem F: nem SQLite)
- `packages/core/src/workspace-write-proposal.unit.test.ts` (8 testes, unit): fail-closed de baseline (traversal, EACCES, CREATE exists, REPLACE missing, CREATE genuíno), purge em exceção, purge por drift, workspace drift na mesma instância.
- `tests/integration/workspace-write-proposal.test.ts` (7 testes, integration): usa o WorkspaceAdapter REAL contra diretório temporário real — traversal/absoluto recusados sem escrita/manifesto/payload, CREATE exists/REPLACE missing contra arquivos reais, CREATE legítimo PENDING_REVIEW, workspace drift e substituição A→B com purga.

### Correção 4 — E2E de expiração (tests/e2e/desktop.spec.ts)
- Gate de ambiente convertido de `return` silencioso (falso PASS) para `test.skip(condição, motivo)` explícito e visível; no Linux reporta SKIP, nunca PASS.
- O teste localiza o tombstone da Proposal A pelo ID (não mais locator genérico que também casa B): A=EXPIRED, B=PENDING_REVIEW, `lookupProposalStatus(A)=EXPIRED` (idempotente), `applyProposedWorkspaceWrite(A)` falha e o arquivo de A não existe.
- Marcadores privados A/B verificados ausentes em: DOM, conversation pública do renderer, planning events/Flight Recorder, agent history, AuditLog e SQLite (studio.sqlite*).

### Documentação
- `.agent/CHANGELOG_AGENT.md` restaurado: todo o histórico anterior (Waves 0/1 e migrações) foi recuperado de `origin/main`; a Wave 14 foi ADICIONADA, sem substituir entradas antigas.
- STATUS/NEXT_ACTION/SESSION_HANDOFF/CURRENT_TASK reconciliados para distinguir Master Wave 1 (em andamento) de checkpoint candidate wave-14; não há avanço para Terminal/Git/autonomous loop.

### Gates
- Executado no Arena (Linux): lint ✅, typecheck ✅, unit (novos 8 + suíte), security, integration (novos 7 cross-platform), build.
- BLOCKED para Windows real (F:): `scripts/pnpm-f.ps1 validate` e `pnpm test:e2e` (inclui o E2E de expiração e os testes de persistência SQLite gated por F:).

## 2026-09-04 — Wave 14, provider-neutral tool protocol + proposal expiration safety

### Provider-neutral tool call protocol
- Added `NormalizedToolCallEnvelope` contract in packages/contracts/src/ai.ts — provider-neutral envelope decoupled from Ollama format
- Added `workspaceWriteArgsSchema` shared strict schema for business arguments (relativePath, content, operation) in contracts
- `OllamaAdapter.normalizeToolCall()` translates raw Ollama tool_calls → normalized envelope
- Adapter validates business arguments via `workspaceWriteArgsSchema.parse()` before calling proposal callback
- Adapter rejects non-object arguments (malformed Ollama responses)

### Canonical propose path
- Main process uses `proposeFromEnvelope()` instead of legacy `propose()` with manual parsing
- Flow: raw provider tool call → adapter structural normalization → NormalizedToolCallEnvelope → adapter business validation → privileged runtime → proposal service → manifest → approval → PolicyEngine → materialization

### Shared business argument validation
- `workspaceWriteArgsSchema` in contracts with `.strict()` — rejects extra fields, unknown operations, null bytes
- Both adapter and proposal service validate against the same shared schema
- Provider-neutral: no Ollama-specific validation in core

### Safe baseline lookup via dependency injection
- `WorkspaceBaselineLookup` interface injected into `WorkspaceWriteProposalService`
- Core never imports fs, path, or any adapter directly
- `inspectWriteTarget()` from WorkspaceAdapter uses path security (resolveLexicalPath + assertRealPathInside)
- CREATE validates that target does NOT exist; REPLACE validates that target exists with valid SHA-256 hash

### EXPIRED proposal status
- `proposalStatusValues` in contracts includes EXPIRED
- `lookupStatus()` uses `validateProposalState()` — same causal validation as `consume()`
- Unified causal validation: workspace drift, slot superseded, thread drift, turn drift, toolcall drift, manifest drift, payload drift
- Expired proposals are purged from memory; no file is written
- `proposalStatusInputSchema` IPC channel for renderer to query proposal status

### EXPIRED in UI
- Renderer uses `ProposalStatus` from contracts (removed local duplicate type)
- `lookupProposalStatus()` IPC bridges renderer → main → proposal service
- Replaced proposals show tombstone EXPIRED with public provenance
- Private content never crosses IPC

### Fixed 6 ollama unit test regressions
- Adapter now validates business arguments before calling proposal service callback
- Tests for DELETE operation, extra provenance, extra argument, missing field, wrong type, malformed JSON all pass

### New tests (6)
- CREATE target exists → rejected
- REPLACE target missing → rejected
- Proposal replaced → lookupStatus returns EXPIRED
- Workspace drift → EXPIRED
- Thread drift → EXPIRED
- Payload purged on expiration

### E2E expiration test
- Written in tests/e2e/desktop.spec.ts
- BLOCKED on Linux (requires F: drive, Electron display)
- Executable on Windows real machine

## 2026-09-04 — Wave 14, cross-platform test fixes

- Fixed 3 test files (terminal.test.ts, workspace.test.ts, path-security.test.ts) for cross-platform compatibility
- Added `isWindows` guards for Windows-only test paths (F: drive, LOCALAPPDATA)
- All 38 affected tests pass on Linux

## 2026-08-17 — Wave Mestre 1, consumo aprovado de propostas

- Adicionado canal IPC/preload tipado que recebe somente o id da proposta e materializa `workspace.write` apenas após a aprovação do manifesto, sem reenviar nem persistir o conteúdo pelo renderer.
- Antes da escrita, o processo principal relê a proveniência thread/turn, workspace e todos os campos do manifesto, reserva o efeito uma única vez, reavalia PolicyEngine e registra AuditLog/Flight Recorder redigidos.
- Propostas sem fonte, substituídas, alteradas ou obsoletas são invalidadas sem escrita; remetentes IPC não confiáveis também deixam auditoria de negação.

## 2026-08-17 — Wave Mestre 1, propostas efêmeras de escrita

- Adicionado serviço de runtime que valida a proveniência da proposta contra thread/turn persistidos, cria manifesto `workspace.write` de alto risco e mantém o conteúdo exclusivamente em memória.
- Nova proposta para o mesmo passo substitui e invalida a anterior; alteração de workspace ou manifesto invalida o consumo. IPC/preload retornam somente metadados da proposta.

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
