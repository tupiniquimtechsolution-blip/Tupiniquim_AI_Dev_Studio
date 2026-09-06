# Status

Atualizado em: 2026-09-06

## Estado atual

- Master Wave: 1 — Dev AI local autônomo (**EM ANDAMENTO**, ver `.agent/MASTER_PLAN.md`)
- Checkpoint: wave-14 — Provider-neutral tool protocol + proposal provenance + expiration safety
- **wave-14: APROVADO/FECHADO** (checkpoint interno da Master Wave 1; **NÃO** é uma nova Master Wave)
- Current branch: `arena/01a06dcc-tupiniquim-ai-dev-studio`
- PR atual: #15
- Issue referenciada: #11
- HEAD validado no Windows F: `2703ed5cef0188e9b9e548bcdca84a7d7328c6e0`
- Repositório operacional (máquina real): `F:\CODEX\Tupiniquim-AI-Dev-Studio`
- Dados: `F:\CODEX\Tupiniquim-AI-Dev-Studio.data`

## Contexto de onda

- O `MASTER_PLAN` mantém a **Master Wave 1 em andamento**. `wave-14` é um checkpoint
  aprovado/fechado dessa Master Wave 1, NÃO uma nova wave mestre.
- O próximo trabalho será definido pela próxima unidade da Master Wave 1 conforme
  `.agent/MASTER_PLAN.md`. Não há avanço de escopo nesta alteração.
- Terminal mutável e Git mutável continuam **INDISPONÍVEIS**. Não se avança para
  "Wave 15 / autonomous loop" com este fechamento.

## Gates Windows F: — evidência real

Na máquina Windows real (`F:`), com o wrapper de validação oficial:

| Gate | Resultado |
|---|---|
| `pnpm-f.ps1 validate` | PASS integral |
| `pnpm test:unit` | 52/52 PASS |
| `pnpm test:integration` | 42 passed / 2 skipped |
| `tests/integration/persistence.test.ts` | 22/22 PASS |
| `pnpm test:security` | 34/34 PASS |
| `pnpm build` | PASS |
| `pnpm-f.ps1 test:e2e` | 2/2 PASS (executado DUAS vezes) |

- `git status --short`: limpo após os gates.
- Nenhuma falha env-gated pendente para os itens antes BLOCKED (Windows `F:`,
  persistence SQLite, E2E). O status BLOCKED referente a esses itens foi **removido**.

## Fluxo final comprovado pelo E2E Windows F:

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

## Correções incluídas no checkpoint wave-14

1. **Baseline FAIL CLOSED** — removido o catch genérico que transformava erro de
   inspeção/path em "alvo inexistente". Erros de `WorkspaceAdapter.inspectWriteTarget()`
   (traversal, absoluto, symlink, namespace, permissão, inesperado) recusam a proposta.
2. **Provenance de continuação na mesma thread** — proposal B com o mesmo
   `executionId`/`stepId` reutiliza internamente a thread T da proposta A; `A = EXPIRED`,
   `B = PENDING_REVIEW`; `apply(A)` falha e o arquivo de A não existe.
3. **Purge garantido no EXPIRED** — `lookupStatus()` invalida o payload efêmero também
   no caminho de exceção; payload não fica residente após EXPIRED.
4. **Correção do driver de drift no gate Windows** — o teste
   `lookupStatus retorna EXPIRED quando provider da thread de origem deriva` faz
   upsert na MESMA row (`id: thread.id` mantido), altera o provider e comprova
   `PENDING_REVIEW` antes, `EXPIRED` depois e `consume()` rejeitado.
5. **E2E de expiração** — gate explícito; tombstone por ID; varredura de marcadores
   privados em DOM, conversation, Flight Recorder/events, agent history, AuditLog e SQLite.

## Preservado (arquitetura aprovada — não refatorado)

NormalizedToolCallEnvelope; workspaceWriteArgsSchema strict; protocolo
provider-neutral; proposeFromEnvelope(); WorkspaceBaselineLookup via DI;
WorkspaceAdapter.inspectWriteTarget(); ProposalStatus com EXPIRED;
lookupProposalStatus IPC; tombstone público; validação do adapter Ollama;
PolicyEngine; ApprovalStore/PlanApprovalService; AuditLog; payload privado só em
memória; Terminal mutável indisponível; Git mutável indisponível.

## Próximo passo

1. Consultar `.agent/MASTER_PLAN.md` para definir a **próxima unidade da Master Wave 1**.
2. NÃO fazer merge do PR #15. Parar para auditoria externa após este fechamento documental.

## Bloqueios externos

- OPENAI_API_NO_CREDITS bloqueia somente inferência live paga; não invalida o transporte controlado.
- Provedores visuais pagos permanecem NOT_CONFIGURED.
