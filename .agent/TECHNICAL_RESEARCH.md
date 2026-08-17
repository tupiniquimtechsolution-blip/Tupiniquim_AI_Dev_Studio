# Pesquisa Técnica

## Decisões

- Electron: integração nativa com Node/PTY/Git/Codex e ambiente já disponível. Segurança baseada em sandbox, context isolation e preload mínimo.
- Tauri: rejeitado na V1 pela ausência de Rust e por exigir sidecar Node nas capacidades centrais.
- Codex App Server: escolhido para integração profunda com autenticação, histórico, aprovações e eventos; SDK reservado a automação/CI.
- Transporte Codex: stdio JSONL estável. WebSocket remoto e APIs experimentais ficam fora da V1.
- Persistência: `node:sqlite` em worker, evitando dependência nativa adicional num host sem toolchain C++.
- Terminal: `node-pty`/ConPTY atrás de adapter e teste de compatibilidade.
- Preview: Playwright/Electron e navegador isolado, usando Edge existente ou cache de browser em D:\CODEX.
- Packaging: artefato portátil e unpacked; assinatura e auto-update dependem de infraestrutura externa.

## Fontes primárias

- https://learn.chatgpt.com/docs/app-server
- https://www.electronjs.org/docs/latest/tutorial/security
- https://www.electronjs.org/docs/latest/tutorial/process-model
- https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html
- https://github.com/microsoft/node-pty
- https://playwright.dev/docs/api/class-electron
