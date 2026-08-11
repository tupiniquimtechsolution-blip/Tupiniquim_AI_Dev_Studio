# Mapa do Repositório

```text
AGENTS.md                              regras para agentes
.agent/                                memória durável, decisões, pesquisas e status
apps/desktop/src/main/index.ts         processo privilegiado, janela segura e handlers IPC
apps/desktop/src/preload/index.ts      ponte mínima contextBridge
apps/desktop/src/renderer/             HUD React, Monaco, xterm e estilos
packages/contracts/src/                domínio, Result e schemas/contratos IPC
packages/core/src/                     PolicyEngine e máquina XState
packages/adapters/src/workspace.ts     filesystem seguro e escrita atômica
packages/adapters/src/path-security.ts confinamento de caminhos e symlinks
packages/adapters/src/git.ts           status/diff Git real
packages/adapters/src/terminal.ts      PTYs ConPTY reais
packages/adapters/src/audit-log.ts     trilha JSONL redigida
packages/ui/src/index.ts               tokens Carbono/Floresta
scripts/                               bootstrap e validação E-only
tests/                                 integração, segurança e E2E
fixtures/dogfood/                      projetos descartáveis das ondas finais
```

## Fluxo atual

`Renderer → window.studio → preload → IPC Zod → adapter privilegiado → Result estruturado`

Entrypoints de AI, persistência, pesquisa, Visual Lab e preview serão acrescentados nas ondas correspondentes e registrados aqui.
