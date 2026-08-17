# Arquitetura

## Visão

Monólito modular Electron composto por um processo main privilegiado, preload mínimo, renderer isolado, workers para persistência e adapters supervisionados. O renderer envia intenções tipadas; ele nunca recebe primitivas arbitrárias de filesystem/processo.

## Módulos

- `apps/desktop`: composição Electron, preload e HUD React.
- `packages/contracts`: schemas Zod, tipos, eventos e erros.
- `packages/core`: state machines, planos, política, aprovações, prompts e resolução tecnológica.
- `packages/adapters`: filesystem, Git, terminal, Codex, pesquisa, visual e preview.
- `packages/ui`: tokens, componentes e layouts.
- `fixtures/dogfood`: workspaces descartáveis.

## Fluxo privilegiado

```text
Renderer -> preload allowlist -> IPC schema -> PolicyEngine -> adapter -> AuditLog
                                                     |            |
                                               ApprovalStore   Result schema
```

Toda chamada contém `requestId`, `sessionId`, `workspaceId`, capability e input validado. A resposta usa `Result<T>` e `AppError` sanitizado. PolicyEngine valida raiz, perfil, risco, rede, destrutividade e escopo da aprovação antes do adapter.

## Estado

XState governa a máquina de trabalho. SQLite persiste snapshots e uma linha de eventos para retomada. Estados terminais são `COMPLETED`, `FAILED`, `ROLLBACK` e `CANCELLED`; `BLOCKED` e `NEEDS_USER_INPUT` preservam contexto retomável.

## Persistência

`node:sqlite` roda em worker dedicado. Banco em `D:\CODEX\Tupiniquim-AI-Dev-Studio.data\studio.sqlite`, WAL, foreign keys, migrations numeradas e backup em `...\backups`. Writes são serializados.

Entidades: UserSettings, Project, Workspace, Session, AgentThread, Task, Plan, PlanStep, Approval, ToolCall, ToolResult, ResearchSource, KnowledgeEntry, Prompt, PromptVersion, Theme, LayoutProfile, Asset, AssetSource, GitCheckpoint, Execution, TestRun e AuditLog.

## Codex

`CodexAdapter` inicia `codex app-server --listen stdio://`, executa initialize/initialized e converte JSONL em eventos internos. A superfície experimental fica desativada. `thread/shellCommand` é proibido. Autenticação e tokens são mantidos pelo app-server; API key local é opcional e ignorada pelo Git.

## Preview

Processos de desenvolvimento são iniciados pelo TerminalProvider. Previews usam partição sem Node, navegação allowlisted e CSP própria. URLs externas abrem fora da janela privilegiada. Mobile V1 usa viewports responsivos; emulador depende de toolchain instalado.
