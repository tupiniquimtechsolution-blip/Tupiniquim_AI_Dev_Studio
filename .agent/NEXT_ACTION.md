# Próxima ação

Master Wave: **1 (EM ANDAMENTO)**.

Wave 16: implementação, auditoria técnica, gates reais Windows F:, documentação, merge do PR #23 e fechamento da Issue #18 **CONCLUÍDOS**.

## Agora

1. Criar a tag anotada `checkpoint/wave-16` no HEAD atual da branch canônica `wave-16/restart-recovery-tupiniquim-session`.
2. Confirmar que a tag aponta para o HEAD correto.
3. Não alterar runtime/código antes do checkpoint.
4. Não iniciar Master Wave 2.

## Depois do checkpoint

1. Abrir/iniciar o gate final de dogfood/QA da Master Wave 1.
2. Exercitar o produto como usuário real no Windows F:, incluindo abertura de workspace, providers, sessão, restart/recovery, proposals, logs, shutdown e fluxos principais já aprovados.
3. Registrar bugs reais encontrados pelo dogfood como issues separadas, sem ampliar escopo silenciosamente.
4. Reexecutar gates relevantes após qualquer correção.
5. Somente após dogfood/QA GREEN avaliar o fechamento da Master Wave 1 e a preparação da Master Wave 2.

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

- Branch canônica: `wave-16/restart-recovery-tupiniquim-session`
- PR #23: MERGEADO
- Merge commit: `d23a43e5543b455c59e193929122f332267fdf18`
- Issue #18: CLOSED / COMPLETED
- HEAD técnico Windows F: `eba4dcc0f428c68ba086a7251375ef9f13b4c94f`
- `pnpm-f.ps1 validate`: PASS integral
- `pnpm-f.ps1 test:e2e`: 4/4 PASS · 0 failed · 0 skipped · 39.8s
- `checkpoint/wave-16`: PENDENTE DE CRIAÇÃO
- Dogfood/QA final: PENDENTE
