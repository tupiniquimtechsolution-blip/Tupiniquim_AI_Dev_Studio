# Tarefa atual

## Objetivo

Fechar as correções finais da Wave 14 (Master Wave 1 em andamento; checkpoint
candidate wave-14) apontadas pela 4ª auditoria do PR #12 (Ref #11), sem recomeçar
o projeto e sem mudar a arquitetura já aprovada.

## Correções aplicadas nesta continuação

1. **Baseline FAIL CLOSED (bloqueante)** — `lookupTargetBaseline()` não tem mais
   catch genérico. Erro de inspeção/path (traversal, absoluto, symlink fora do
   workspace, namespace inválido, permissão, inesperado) propaga e recusa a
   proposta; apenas `{exists:false,hash:null}` real do WorkspaceAdapter significa
   alvo inexistente.
2. **Purge garantido no EXPIRED** — `lookupStatus()` chama `invalidate(id)` também
   quando `validateProposalState()` lança; após EXPIRED o payload não fica
   residente, a segunda consulta segue EXPIRED e `consume()` falha.
3. **Testes de persistência** — workspace drift na MESMA instância (getWorkspaceRoot
   mutável); purge com expiração real antes de lookup/consume.
4. **E2E de expiração** — gate `test.skip` explícito (fim do PASS falso por retorno
   silencioso); A identificada por ID com EXPIRED, B separada com PENDING_REVIEW;
   `lookupProposalStatus(A)=EXPIRED`; `applyProposedWorkspaceWrite(A)` falha; arquivo
   de A não existe; marcadores privados A/B ausentes de DOM, conversation, Flight
   Recorder/events, agent history, AuditLog e SQLite.
5. **Documentação** — CHANGELOG_AGENT.md restaurado do origin/main (histórico
   completo) com a Wave 14 adicionada; STATUS/NEXT_ACTION/HANDOFF reconciliados
   (Master Wave 1 ≠ checkpoint wave-14; sem avanço para Terminal/Git).

## Evidência coletada no Arena (Linux)

- lint ✅, typecheck ✅, build ✅.
- 8 testes unitários novos cross-platform: todos PASSAM.
- 7 testes de integração novos cross-platform com WorkspaceAdapter real: todos PASSAM.
- E2E de expiração: SKIP explícito no Linux (não PASS falso).

## BLOCKED — executar na máquina Windows real (F:)

- `scripts\pnpm-f.ps1 validate`
- `pnpm test:e2e`
- tests/integration/persistence.test.ts (SQLite em F:)
- Quinta auditoria externa; merge/checkpoint somente após aprovação.

## Critérios de aceite restantes

1. Gates Windows F: verdes (validate + e2e).
2. Quinta auditoria externa aprovar.
3. Nenhuma mudança fora de escopo (providers, Terminal/Git mutável, voz, etc.).
