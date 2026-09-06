# Resultados de testes

## 2026-09-06 — Wave 15 — Gate Windows F: (gates técnicos aprovados)

Máquina Windows real (`F:`); branch `arena/01a0776a-tupiniquim-ai-dev-studio`;
PR #17; Issue #16; HEAD de runtime `787bd304ce99c5916ba870870d2b5c2b6600e166`.

| Comando | Resultado |
|---|---|
| `pnpm-f.ps1 validate` | PASS integral |
| F:\CODEX-only | PASS |
| lint | PASS |
| typecheck | PASS |
| `pnpm test:unit` | 82/82 PASS |
| `pnpm test:integration` | 49 passed / 2 skipped |
| `tests/integration/persistence.test.ts` | 22/22 PASS |
| `pnpm test:security` | 34/34 PASS |
| `pnpm build` | PASS |
| `pnpm-f.ps1 test:e2e` | 3/3 PASS |

CI remoto do runtime: run #34 `34067158283` SUCCESS.

### Electron E2E (Windows F:)

1. inicia o Electron seguro e carrega um workspace real — PASS
2. proposta substituída fica EXPIRED e aplicação da antiga é recusada — PASS
3. sessão Tupiniquim sobrevive à troca de provider fake e isola workspace — PASS

### Invariantes cobertos no E2E / validate

- Tupiniquim Session ≠ Provider Thread
- troca de provider preserva sessão; threads provider-specific; sem reuso cross-provider
- workspace A → B → A isolado; status/thread scoped
- workspace switch bloqueado enquanto ocupado; mutex antes do primeiro await
- contexto incremental; ACK só no sucesso terminal
- Codex ERROR/RETRYING não consome contexto
- races completion-before-pending e completion-before-send-return
- ordem user → assistant; proveniência do modelo
- proposal authority não transfere; EXPIRED em troca de provider/workspace
- payload privado ausente de DOM, conversation, SQLite, AuditLog e history coberto
- primeira PLAN reutiliza thread da sessão; `execution.threadId` tem precedência

Nenhuma alteração de código/runtime/teste nesta etapa documental.

GAP WAVE 16: restart/recovery da sessão Tupiniquim / bindings / cursores ainda
não persistidos. Não bloqueia o fechamento técnico da Wave 15.

## 2026-09-06 — Wave 14 — Gate Windows F: (checkpoint aprovado/fechado)

Máquina Windows real (`F:`); branch `arena/01a06dcc-tupiniquim-ai-dev-studio`;
PR #15; Issue #11; HEAD `2703ed5cef0188e9b9e548bcdca84a7d7328c6e0`.

| Comando | Resultado |
|---|---|
| `pnpm-f.ps1 validate` | PASS integral |
| `pnpm test:unit` | 52/52 PASS |
| `pnpm test:integration` | 42 passed / 2 skipped |
| `tests/integration/persistence.test.ts` | 22/22 PASS |
| `pnpm test:security` | 34/34 PASS |
| `pnpm build` | PASS |
| `pnpm-f.ps1 test:e2e` | 2/2 PASS |

- O E2E foi executado **duas vezes** com sucesso.
- `git status --short` antes do fechamento documental: limpo.
- Status `BLOCKED` referente a Windows `F:`, `persistence` e `E2E` foi removido:
  os gates reais passaram na máquina Windows.
- Nenhuma alteração de código/runtime/teste nesta etapa documental.

### Fluxo final comprovado no Windows F:

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

## 2026-08-17 — Wave 1, consumo aprovado de propostas

| Comando | Resultado |
|---|---|
| scripts\pnpm-d.ps1 validate | PASS: validação D:, lint, typecheck, 17 unitários, 15 integrações (2 opt-in ignorados), 4 segurança e build |
| scripts\pnpm-d.ps1 test:integration | PASS: 15 integrações (2 opt-in ignorados) |
| scripts\pnpm-d.ps1 test:e2e | PASS: 1 cenário Electron real |

- A integração cobre conteúdo somente em memória, proposta substituída, fonte thread/turn expirada e alteração de qualquer campo relevante do manifesto antes do consumo.
- O E2E confirma o Electron seguro e o `workspace.write` aprovado; a proposta foi validada em integração sem depender de inferência externa.

## 2026-08-17 — Wave 1, propostas efêmeras de escrita

| Comando | Resultado |
|---|---|
| scripts\pnpm-d.ps1 validate | PASS: validação D:, lint, typecheck, 17 unitários, 15 integrações (2 opt-in ignorados), 4 segurança e build |
| scripts\pnpm-d.ps1 typecheck | PASS |
| scripts\pnpm-d.ps1 test:integration | PASS: 15 integrações (2 opt-in ignorados) |
| scripts\pnpm-d.ps1 test:e2e | PASS: 1 cenário Electron real |

- A integração verifica proveniência por thread/turn, ausência de payload no objeto público/plano e invalidação de proposta substituída.

## 2026-08-17 — Wave 1, retomada legada de efeitos

| Comando | Resultado |
|---|---|
| scripts\pnpm-d.ps1 validate | PASS: validação D:, lint, typecheck, 17 unitários, 14 integrações (2 opt-in ignorados), 4 segurança e build |
| scripts\pnpm-d.ps1 test:integration | PASS: 14 integrações (2 opt-in ignorados) |
| scripts\pnpm-d.ps1 typecheck | PASS |
| scripts\pnpm-d.ps1 test:e2e | PASS: 1 cenário Electron real |

- A integração persiste um payload de execução anterior, sem `completedEffectIds`, e confirma que a leitura o normaliza para uma lista vazia sem migração destrutiva.

## 2026-08-17 — Wave 1, workspace.write aprovado

| Comando | Resultado |
|---|---|
| scripts\pnpm-d.ps1 validate | PASS: validação D:, lint, typecheck, 17 unitários, 13 integrações (2 opt-in ignorados), 4 segurança e build |
| scripts\pnpm-d.ps1 typecheck | PASS |
| scripts\pnpm-d.ps1 test:integration | PASS: 13 integrações (2 opt-in ignorados) |
| scripts\pnpm-d.ps1 build | PASS: Electron production build |
| scripts\pnpm-d.ps1 test:e2e | PASS: 1 cenário Electron real |

- O E2E cria e remove uma fixture Git temporária no disco D:, sem tocar no workspace do repositório, e verifica recusa por alvo/hash, escrita aprovada, repetição bloqueada e conteúdo resultante.

## 2026-08-17 — Wave 1, manifestos imutáveis de efeitos

| Comando | Resultado |
|---|---|
| scripts\validate-d-drive.ps1 | PASS: regra D:\CODEX-only e componentes locais |
| scripts\pnpm-d.ps1 lint | PASS |
| scripts\pnpm-d.ps1 typecheck | PASS |
| scripts\pnpm-d.ps1 test:unit | PASS: 17 unitários |
| scripts\pnpm-d.ps1 test:integration | PASS: 12 integrações (2 opt-in ignorados) |
| scripts\pnpm-d.ps1 test:security | PASS: 4 cenários |
| scripts\pnpm-d.ps1 build | PASS: Electron production build |
| scripts\pnpm-d.ps1 test:e2e | PASS: 1 cenário Electron real |

- Integração cobre manifesto ausente, tentativa de reduzir a exigência de aprovação e invalidação da decisão quando o alvo ou efeito muda.
- O E2E só inicia execução depois de persistir manifestos tipados e obter as aprovações correspondentes; ele preserva a evidência read-only de workspace e Git.

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
