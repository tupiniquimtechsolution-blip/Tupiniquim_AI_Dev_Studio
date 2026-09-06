# Status

Atualizado em: 2026-09-06

## Estado atual

- Master Wave: 1 — Dev AI local autônomo (**EM ANDAMENTO**, ver `.agent/MASTER_PLAN.md`)
- Checkpoint: wave-15 — Tupiniquim-owned conversation continuity
- **wave-15: gates técnicos APROVADOS**; fechamento formal (merge/tag `checkpoint/wave-15`) após auditoria externa e merge controlado do PR #17
- Current branch: `arena/01a0776a-tupiniquim-ai-dev-studio`
- PR atual: #17
- Issue referenciada: #16
- HEAD de runtime validado no Windows F: `787bd304ce99c5916ba870870d2b5c2b6600e166`
- Repositório operacional (máquina real): `F:\CODEX\Tupiniquim-AI-Dev-Studio`
- Dados: `F:\CODEX\Tupiniquim-AI-Dev-Studio.data`

## Contexto de onda

- O `MASTER_PLAN` mantém a **Master Wave 1 em andamento**. `wave-15` é um checkpoint
  interno dessa Master Wave 1, NÃO uma nova wave mestre e NÃO o encerramento da
  Master Wave 1.
- Checkpoints anteriores: wave-13 (ciclo de propostas), wave-14 (protocolo
  provider-neutral + provenance + expiration).
- Próxima unidade prevista: **wave-16 — restart/recovery da memória/sessão Tupiniquim**.
  Não iniciar Wave 16 nesta etapa.
- Terminal mutável e Git mutável continuam **INDISPONÍVEIS**.

## Gates Windows F: — evidência real (runtime HEAD `787bd30`)

Na máquina Windows real (`F:`), com o wrapper de validação oficial:

| Gate | Resultado |
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

## E2E Electron (Windows F:)

1. inicia o Electron seguro e carrega um workspace real — PASS
2. proposta substituída fica EXPIRED e aplicação da antiga é recusada — PASS
3. sessão Tupiniquim sobrevive à troca de provider fake e isola workspace — PASS

## Invariantes Wave 15 comprovados

- Tupiniquim Session ≠ Provider Thread
- troca de provider preserva a sessão Tupiniquim
- threads continuam provider-specific; sem reutilização cross-provider
- workspace A → B → A isolado; thread/status scoped por workspace/session
- workspace switch bloqueado enquanto o runtime está ocupado
- transição de workspace protegida antes do primeiro await
- contexto público incremental entre providers
- ACK apenas após sucesso terminal (`TURN_COMPLETED` / SUCCESS)
- Codex ERROR/RETRYING não consome contexto
- ERROR/CANCELLED/FAILED não ACKam contexto incorretamente
- race completion-before-pending tratada
- race completion-before-send-return tratada
- ordem user → assistant preservada
- proveniência do modelo preservada
- proposal authority não transfere de provider
- proposal EXPIRED ao trocar provider/workspace quando aplicável
- payload privado ausente de DOM, conversation, SQLite, AuditLog e history coberto
- renderer não escolhe provenance privilegiada
- primeira PLAN reutiliza thread confiável da sessão quando apropriado
- `execution.threadId` tem precedência
- sem chat anterior, o provider pode criar a primeira thread

## Bugs reais descobertos pelo Windows F: (corrigidos no runtime)

1. CHAT Ollama criava T1 e a primeira PLAN tentava criar T2.
   Correção: `execution.threadId ?? session.threadFor(provider) ?? undefined`.
2. Codex fake podia emitir `turn/completed` antes do retorno de `send()`, e BUSY
   tardio sobrescrevia READY. Correção: `terminalTurns` / monotonicidade de status.

## GAP explícito — Wave 16

Restart/recovery permanece **GAP WAVE 16**. Ainda NÃO persistimos completamente:

- Tupiniquim Session
- provider bindings
- seen-by-provider cursors
- lifecycle necessário para recuperação

Observação para Wave 16 (não bloqueia o fechamento da Wave 15): `terminalTurns` e
`finalizedTurns` são estruturas in-memory e precisarão de bounded cleanup / recovery.

## Preservado

PolicyEngine; ApprovalStore/PlanApprovalService; AuditLog; payload privado só em
memória; schema público `agentSendInputSchema` sem `proposalContext + threadId`;
Terminal mutável indisponível; Git mutável indisponível.

## Próximo passo

1. Auditoria externa do diff documental.
2. Depois: merge controlado do PR #17, fechar Issue #16, tag `checkpoint/wave-15`.
3. Somente então preparar Wave 16.
4. NÃO mergear o PR #17 nesta etapa. NÃO iniciar Wave 16.

## Bloqueios externos

- OPENAI_API_NO_CREDITS bloqueia somente inferência live paga; não invalida o transporte controlado.
- Provedores visuais pagos permanecem NOT_CONFIGURED.
