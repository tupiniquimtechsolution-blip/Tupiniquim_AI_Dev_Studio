# Tarefa atual

## Objetivo

Executar a **Wave 17 — dogfood/QA final e gate de fechamento da Master Wave 1**.

A Wave 16 está formalmente encerrada e marcada por `checkpoint/wave-16`. Esta etapa NÃO adiciona novas features; ela valida o produto integrado em uso real antes de permitir o fechamento da Master Wave 1.

## Identificação

- Branch: `wave-17/master-wave-1-dogfood-qa`
- Issue: #24 — `[MASTER WAVE 1] wave-17 — dogfood/QA final e gate de fechamento`
- Baseline do checkpoint: `checkpoint/wave-16`
- Commit do checkpoint: `0b46bd60996aa6f87e495cffa8c4ff1bc4d1c0e8`
- Master Wave 1: EM ANDAMENTO
- Master Wave 2: NÃO INICIADA

## Escopo

Dogfood/QA real obrigatório:

1. startup e workspace real;
2. Tupiniquim Session e conversa integrada;
3. troca explícita de providers/modelos;
4. restart real e recovery;
5. isolamento workspace A → B → A;
6. proposal/approval/EXPIRED;
7. persistência, privacidade e ausência de payload privado/secrets;
8. UX/estado BUSY/READY/provider/model;
9. regressão automatizada Windows F: `validate` + `test:e2e`.

## Regra de execução

Primeiro coletar evidência. Não corrigir silenciosamente.

Cada achado deve ser classificado como:

- PRODUCTION BUG
- E2E/HARNESS BUG
- UX BUG
- DOCUMENTATION GAP
- ENVIRONMENT
- OUT OF SCOPE

Correções só são autorizadas se houver reprodução concreta e devem ser mínimas, delimitadas e seguidas de nova auditoria/gates.

## Critério de conclusão

A Wave 17 só pode ser fechada quando:

- todos os cenários de dogfood forem executados;
- `validate` Windows F: estiver GREEN;
- Electron E2E estiver GREEN;
- nenhum bloqueio crítico/alto permanecer aberto;
- documentação final estiver atualizada;
- auditoria externa final aprovar o estado.

Somente depois disso a Master Wave 1 poderá ser declarada concluída. Master Wave 2 continua bloqueada até lá.
