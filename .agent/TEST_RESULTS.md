# Resultados de testes

## 2026-08-17 — Wave 0, checkpoint 8bab9fe

| Comando | Resultado |
|---|---|
| scripts\validate-d-drive.ps1 | PASS |
| scripts\pnpm-d.ps1 validate | PASS: lint, typecheck, 11 unitários, 8 integrações (2 opt-in ignorados), 4 segurança e build |
| scripts\pnpm-d.ps1 test:e2e | PASS: 1 cenário Electron real |

## Evidência funcional adicional

- O transporte JSONL controlado verificou criação, streaming, interrupção, persistência sanitizada e retomada de thread.
- O E2E verificou que escrita de workspace sem aprovação retorna APPROVAL_REQUIRED e que git reset --hard é bloqueado por política.
- Inferência live OpenAI continua opt-in e pode retornar OPENAI_API_NO_CREDITS; não foi usada como evidência de sucesso.

## 2026-08-17 — Wave 1, runtime local Ollama

| Comando | Resultado |
|---|---|
| scripts\pnpm-d.ps1 validate | PASS: validação D:, lint, typecheck, 17 unitários, 8 integrações (2 opt-in ignorados), 4 segurança e build |
| scripts\pnpm-d.ps1 test:e2e | PASS: 1 cenário Electron real |

- O adapter controlado cobre discovery de modelos, streaming NDJSON, seleção explícita, interrupção, persistência hash-only, redaction e bloqueio de hosts remotos.
- Nesta máquina o runtime Ollama não foi encontrado; o estado NOT_INSTALLED foi retornado sem qualquer tentativa de instalação, download ou modelo.
- O E2E usou o seletor real do painel para trocar para Ollama local, mantendo sandbox e bridge preload.

## 2026-08-17 — Wave 1, contexto de workspace

| Comando | Resultado |
|---|---|
| scripts\pnpm-d.ps1 validate | PASS: validação D:, lint, typecheck, 17 unitários, 9 integrações (2 opt-in ignorados), 4 segurança e build |
| scripts\pnpm-d.ps1 test:e2e | PASS: 1 cenário Electron real |

- O catálogo retorna somente caminhos relativos, tipos e tamanhos, limita-se a 256 entradas e não lê conteúdo de arquivo.
- Itens ocultos, .env, dependências e diretórios de build ficam fora do catálogo. Nomes passam por redaction e são avisados como conteúdo não confiável antes do provider.

## 2026-08-17 — Wave 1, baseline de execução aprovado

| Comando | Resultado |
|---|---|
| scripts\pnpm-d.ps1 validate | PASS: validação D:, lint, typecheck, 17 unitários, 11 integrações (2 opt-in ignorados), 4 segurança e build |
| scripts\pnpm-d.ps1 test:e2e | PASS: 1 cenário Electron real |

- O E2E aprova os passos exigidos, inicia a execução e verifica eventos TOOL e GIT no Flight Recorder.
- O baseline usa somente leituras reais do catálogo metadata-only e git status; não dispara terminal, escrita, mudança de Git ou conclusão de passo simulada.

## 2026-08-17 — Wave 1, histórico recuperável

| Comando | Resultado |
|---|---|
| scripts\pnpm-d.ps1 validate | PASS: validação D:, lint, typecheck, 17 unitários, 11 integrações (2 opt-in ignorados), 4 segurança e build |
| scripts\pnpm-d.ps1 test:e2e | PASS: 1 cenário Electron real |

- A bridge retorna thread, turns e eventos normalizados; a UI mostra somente a contagem de turns e o tipo/status dos eventos.
- O E2E validou consulta de thread inexistente e migrou o banco local legado para a versão 4 com tabelas de IA presentes.
