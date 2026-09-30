# Web Free — Persistência local do Remote Runtime

Status: IMPLEMENTADA / CERTIFICAÇÃO LIVE PENDENTE  
Data: 2026-09-30

## Decisão canônica

Na arquitetura Web Free, o workspace executável vive no Tupiniquim Remote Runtime
no hardware do usuário. A persistência obrigatória para o primeiro release Web
é, portanto, a persistência local do gateway.

R2 é uma extensão opcional de redundância/backup cloud. Não é requisito para o
primeiro release zero-custo e nenhuma credencial R2 deve ser exigida apenas para
marcar o checkpoint local como configurado.

## Fluxo

Worker/Durable State
→ handle lógico do último checkpoint
→ Remote Runtime Gateway
→ `workspace.backup-create`
→ storage local do gateway

No bootstrap:

Durable State
→ handle lógico
→ `workspace.backup-restore`
→ workspace local restaurado

## Configuração

Worker:

`WEB_WORKSPACE_BACKUP_ENABLED=true`

Remote Runtime:

- deve estar `READY`;
- deve anunciar capability `local-persistence`;
- o diretório raiz do gateway deve residir em storage persistente do usuário.

Nenhum destes secrets é necessário para o checkpoint local:

- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

## Fail-closed

- feature não habilitada → `DISABLED`;
- gateway offline → execução continua `OFFLINE` e nenhum checkpoint recebe PASS;
- backup inexistente → bootstrap segue como workspace novo;
- restore inválido/ausente → erro explícito;
- `production_ready=true` exige Remote Runtime `READY` e checkpoint `SNAPSHOT`.

## Gate de certificação live

1. Remote Runtime READY;
2. bootstrap do workspace;
3. criar arquivo com marcador único;
4. checkpoint retorna `SNAPSHOT`;
5. reiniciar o Worker/reciclar a sessão lógica;
6. restaurar pelo mesmo gateway;
7. arquivo e hash permanecem;
8. workspace distinto não vê o arquivo;
9. desligar gateway produz `OFFLINE`, nunca PASS;
10. nenhum token aparece em resposta/log.

## R2

R2 pode ser adicionado posteriormente como segunda camada de redundância, dentro
da franquia gratuita quando aplicável. Essa extensão exige ADR e testes próprios;
não deve reutilizar readiness local como prova de backup cloud.
