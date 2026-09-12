# Próxima ação

Master Wave: **1 (EM ANDAMENTO)**.

Wave 16: implementação + auditoria técnica + gates reais Windows F: **CONCLUÍDOS**.
Estado formal: `IMPLEMENTATION_AND_REAL_MACHINE_GATES_COMPLETE`.

## Agora

1. Auditar externamente o diff documental `.agent/*` desta etapa.
2. NÃO alterar código/runtime/testes sem nova evidência.
3. NÃO mergear antes da aprovação documental externa.
4. NÃO iniciar Master Wave 2.

## Depois da auditoria documental

1. Merge controlado do PR #23 na branch canônica `wave-16/restart-recovery-tupiniquim-session`.
2. Confirmar o SHA e o estado pós-merge.
3. Fechar Issue #18.
4. Criar tag anotada `checkpoint/wave-16`.
5. Executar o gate final de dogfood/QA da Master Wave 1.
6. Somente após esse dogfood avaliar o fechamento da Master Wave 1 e a preparação da Master Wave 2.

## Regras mantidas

- `Tupiniquim Session != Provider Thread`.
- Nenhuma thread cross-provider.
- Nenhuma sessão cross-workspace.
- Proposal authority e payload privado não sobrevivem restart.
- Provider/model continuam escolha explícita do usuário.
- Terminal mutável: **indisponível**.
- Git mutável: **indisponível**.
- Não ampliar escopo durante o fechamento.

## Estado de referência da Wave 16

- Branch do PR: `arena/wave-16-inc4-shutdown-restart`
- Base do PR: `wave-16/restart-recovery-tupiniquim-session`
- PR: #23 — OPEN / NÃO MERGEADO
- Issue: #18 — OPEN
- HEAD técnico Windows F: `eba4dcc0f428c68ba086a7251375ef9f13b4c94f`
- `pnpm-f.ps1 validate`: PASS integral
- `pnpm-f.ps1 test:e2e`: 4/4 PASS · 0 failed · 0 skipped · 39.8s
- `checkpoint/wave-16`: NÃO CRIADO
- Dogfood/QA final: PENDENTE
