# Tupiniquim AI Dev Studio

Leia primeiro `.agent/STATUS.md`, `.agent/EXECUTION_PLAN.md`, `.agent/SECURITY.md` e o ADR relevante.

## Regras invariantes

- Todo artefato controlável do projeto vive em `D:\CODEX`. Não grave código, cache, dados, logs ou builds em outros discos.
- A raiz oficial desta máquina é `D:\CODEX\Tupiniquim-AI-Dev-Studio`; preserve os demais projetos irmãos em `D:\CODEX`.
- Nunca leia, imprima, registre ou versione valores de `.env*`. Use apenas verificações silenciosas de presença.
- Renderer Electron não acessa Node. Toda capacidade privilegiada passa por preload mínimo, IPC tipado, PolicyEngine e AuditLog.
- Nunca simule filesystem, terminal, Git, agentes, pesquisa ou preview. Uma capacidade indisponível deve retornar estado explícito.
- Mudanças destrutivas, rede/credenciais pagas, acesso fora do workspace e elevação exigem aprovação explícita.
- Não use `git reset --hard`, force push ou descarte mudanças do usuário.

## Loop de trabalho

Para cada onda: TESTE → CORRIJA → REVIEW DO DIFF → atualize `.agent/STATUS.md` e `.agent/CHANGELOG_AGENT.md` → commit → tag `checkpoint/wave-NN` → continue.

## Comandos

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap-f.ps1
pnpm validate
pnpm test:dogfood
pnpm package:win
```
