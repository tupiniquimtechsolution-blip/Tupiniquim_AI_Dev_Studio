# Current Task

## Tema Claro/Escuro/Sistema + transições de tela

**Estado: IMPLEMENTADO — aguardando PR/CI (READY_FOR_PR; merge é decisão do mantenedor).**

Escopo entregue:

1. `renderer/src/theme.ts`: preferência semântica `LIGHT|DARK|SYSTEM`,
   parse fail-closed, resolução via `prefers-color-scheme`, controller com
   dependências injetáveis (testável sem DOM), hooks React.
2. `styles.css` e `web-experience.css` reorganizados em tokens claro/escuro
   (`data-theme` no `<html>`); nenhuma condição de tema em JSX.
3. Seletor discreto Sistema/Claro/Escuro (`components/ThemeToggle.tsx`) na
   landing, onboarding, Studio Web e Preferências do Desktop (Acento/Fundo
   preservados como customização avançada).
4. Monaco `vs`/`vs-dark` conforme tema resolvido (App.tsx e web/CodeEditor).
5. Transições de rota no `WebExperience` (exit 180ms + enter 200ms,
   opacity/translateY, CSS-only) e microtransições 120–200ms; tudo
   respeitando `prefers-reduced-motion: reduce`.
6. Testes unit (web-theme) + smoke de tema; documentação em
   `DESIGN_SYSTEM.md`.

Restrições respeitadas: sem novas dependências, sem `transition: all`,
sem remoção de recursos, CSP sem inline script, identidade verde mantida.
