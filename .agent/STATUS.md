# Status

Atualizado em: 2026-09-22

## Estado atual

- Master Wave: 1 — Dev AI local autônomo (**EM ANDAMENTO**, ver `.agent/MASTER_PLAN.md`)
- Wave 16 — restart/recovery da memória e sessão Tupiniquim: **FECHADA**
- PR #23: **MERGEADO**
- Merge commit da Inc4: `d23a43e5543b455c59e193929122f332267fdf18`
- Issue #18: **CLOSED / COMPLETED**
- `checkpoint/wave-16`: **CRIADO E CONFIRMADO**
- checkpoint target: `0b46bd60996aa6f87e495cffa8c4ff1bc4d1c0e8`
- Wave 17 — dogfood/QA final da Master Wave 1: **EM ANDAMENTO**
- Issue atual: #24 — `[MASTER WAVE 1] wave-17 — dogfood/QA final e gate de fechamento`
- Branch RC1 atual: `arena/01a0c8ba-tupiniquim-ai-dev-studio`
- PR RC1: #32 — **DRAFT / NÃO MERGEADO**
- Repositório operacional: `F:\CODEX\Tupiniquim-AI-Dev-Studio`
- Dados operacionais: `F:\CODEX\Tupiniquim-AI-Dev-Studio.data`
- Master Wave 2: **NÃO INICIADA**
- Project Bible canônica: `docs/PROJECT_BIBLE/README.md`

## Situação da Wave 16

A Wave 16 está formalmente encerrada no checkpoint `checkpoint/wave-16`, confirmado no remoto e apontando para `0b46bd60996aa6f87e495cffa8c4ff1bc4d1c0e8`.

A conclusão da Wave 16 **não encerra a Master Wave 1**. O gate final obrigatório agora é a Wave 17 de dogfood/QA integrado.

## Baseline autoritativo herdado da Wave 16

HEAD técnico Windows F: `eba4dcc0f428c68ba086a7251375ef9f13b4c94f`.

| Gate | Resultado |
|---|---|
| `pnpm-f.ps1 validate` | PASS integral |
| F:\CODEX-only | PASS |
| lint | PASS |
| typecheck | PASS |
| `pnpm test:unit` | 194/194 PASS |
| `pnpm test:integration` | 99 passed / 2 skipped |
| `tests/integration/tupiniquim-shutdown-restart.test.ts` | 4/4 PASS |
| `pnpm test:security` | 34/34 PASS |
| `pnpm build` | PASS |
| `pnpm-f.ps1 test:e2e` | 4/4 PASS · 0 failed · 0 skipped · 39.8s |

## Wave 17 — objetivo

Executar dogfood/QA real sobre a base do checkpoint Wave 16, usando o produto como produto e procurando regressões ou inconsistências que a suíte automatizada possa não capturar.

Cobertura obrigatória:

- startup e workspace real;
- Tupiniquim Session e continuidade;
- multi-provider explícito;
- restart real;
- isolamento A → B → A;
- proposal/approval/EXPIRED;
- privacidade e persistência;
- UX/estado BUSY/READY/provider/model;
- `validate` Windows F:;
- Electron E2E.

Achados devem ser classificados como `PRODUCTION BUG`, `E2E/HARNESS BUG`, `UX BUG`, `DOCUMENTATION GAP`, `ENVIRONMENT` ou `OUT OF SCOPE`.

## Regras de fechamento

- nenhuma nova Master Wave durante Wave 17/RC1;
- gaps funcionais já comprovados da própria V1 podem e devem ser corrigidos na mesma RC1;
- nenhum bloqueio crítico/alto pode permanecer aberto;
- documentação final só depois da evidência real;
- auditoria externa obrigatória antes de fechar a Master Wave 1;
- Master Wave 2 permanece bloqueada até esse fechamento.

## RC1 consolidation — estado atual

Branch Arena `arena/01a0c8ba-tupiniquim-ai-dev-studio`; Wave17 + `main`/Google Tasks integrados sem alteração em `main`. RC1 **NÃO APROVADA V1**: build JS disponível, lacunas reais de produto registradas em `docs/RC1/KNOWN_ISSUES.md` e `docs/PROJECT_BIBLE/MATRIZ_RASTREABILIDADE_V1.md`; gates Windows/providers/OAuth ainda em validação.

O setup Windows encontrou um bug real de PowerShell 5.1 no probe da versão Node; correção aplicada na mesma RC1 no commit `c4714cafcecb5025bdbc35495205477627930f8a`. Os commits documentais posteriores não alteram runtime/setup.

## Backlog V1 rastreado pelo Agenor

#18 permanece umbrella de consolidação. As lacunas V1 foram materializadas no Notion como #19–#33: Files UX, Terminal, Git, providers reais, EXECUTE/VISUAL, Test Runner/Evidence, perfis de autonomia, browser-second, Prompt Architect, Visual Lab, Preferences, Preview, Windows package/E2E/ConPTY, Google Tasks OAuth real e closeout V1/Master Wave 1.

## Documentação canônica complementar

- `docs/PROJECT_BIBLE/BIBLIA_DO_PROJETO.md`
- `docs/PROJECT_BIBLE/BACKLOG_E_STATUS.md`
- `docs/PROJECT_BIBLE/MATRIZ_RASTREABILIDADE_V1.md`
- `docs/PROJECT_BIBLE/QA_RELEASE_SECURITY.md`
- `docs/PROJECT_BIBLE/OPERACAO_DEPLOYMENT_SUPORTE.md`
- `docs/PROJECT_BIBLE/MODELOS_PROVIDERS_AGENTES.md`
- `docs/PROJECT_BIBLE/MERCADO_PRECIFICACAO_E_VALOR.md`
- `docs/PROJECT_BIBLE/AGENOR_SYNC.md`
- `docs/PROJECT_BIBLE/PROMPT_MANTENEDOR_BIBLIA.md`

## Próximo passo

Concluir o setup/verify no Windows real; registrar qualquer falha concreta; corrigir blockers V1 no mesmo PR #32; reexecutar gates no HEAD final; fechar #19–#32 por evidência; só então executar #33 (auditoria, documentação final e checkpoint da Master Wave 1).
