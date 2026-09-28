# Status

Atualizado em: 2026-09-28

## Fonte de verdade

- GitHub é a fonte de verdade para código, contratos, Issues, PRs, commits, CI, evidências e documentação operacional.
- Branch de integração ativa: `integration/ai-lab-toolbox-unified`.
- Baseline desta reconciliação: `4cf2660e2cf2f1ca2f5a71fd0f3c551d67b9eca8`.
- Um gate só vale para o SHA exato em que foi executado.
- `BUILD PASS != PRODUTO FUNCIONA != PRODUÇÃO CERTIFICADA`.

## Estado consolidado das Master Waves

- MW0: CONCLUÍDA.
- MW1: implementação cloud consolidada; certificação Windows/hardware permanece em trilha própria.
- MW2: CLOUD-GREEN / CONCLUÍDA.
- MW3: CLOUD-GREEN / CONCLUÍDA.
- MW4: CLOUD-GREEN / CONCLUÍDA.
- MW5: CLOUD-GREEN / CONCLUÍDA na trilha cloud.
- U0–U6 da plataforma unificada foram materializados na linha `integration/ai-lab-toolbox-unified`.

Os documentos históricos que diziam “MW2 NÃO INICIADA” ou “Wave 17 é a tarefa atual” não representam mais a operação corrente.

## Distribuições do mesmo produto

### Web Full

Arquitetura ativa:
- browser/renderer compartilhado;
- Worker seguro;
- Cloudflare Workers AI;
- Durable Objects;
- Cloudflare Sandbox/Containers;
- workspace cloud em `/workspace`;
- persistência R2 preparada por backup/restore;
- Cloudflare Access preparado com validação JWT;
- Web Product Smoke Gate separado do Cloud Quality.

Estado:
- código/CI: CLOUD-GREEN;
- deploy real: BLOCKED-INFRA;
- causa atual: Cloudflare API `/accounts/.../containers/me` — Issue #53;
- auth de produção: PENDING; `WEB_ALLOW_ANONYMOUS=true` permanece TEST MODE;
- persistência R2: IMPLEMENTADA/PREPARADA, porém `WEB_WORKSPACE_BACKUP_ENABLED=false` até recursos/secrets cloud existirem;
- Web Product Smoke: IMPLEMENTADO, execução real PENDING até existir candidate implantado;
- hostname/Access/`workers.dev`: PENDING — Issue #59;
- produção: NOT CERTIFIED.

### Windows Full

- Electron/Desktop continua distribuição do mesmo produto.
- Codex App Server e Ollama permanecem runtimes locais.
- PowerShell/ConPTY continuam capacidades Windows, não Web.
- hosted Windows já possui evidências históricas GREEN nos candidates registrados.
- certificação física/hardware permanece separada e não bloqueia a publicação Web.

### USB / Portable AI Lab

- distribuição portátil permanece integrada ao produto;
- certificação física USB/SSD, letra variável, runtimes/modelos existentes, hardware e recovery continuam na Issue #51;
- essa certificação não bloqueia o gate de release da edição Web.

## Correções Web Full promovidas em 2026-09-28

### PR #52 — Provider / Runtime / Model + workspace bootstrap

Merge: `314d358a8146c3e4168b41f97a7712a8950c27a7`

- Workers AI deixou de ser mascarado como Ollama;
- provider `cloudflare-workers-ai`;
- runtime `workers-ai`;
- catálogo Web allowlisted;
- modelo padrão Web;
- providers/modelos filtrados por runtime;
- Desktop rejeita provider Web-only;
- `/workspace` é preparado automaticamente na Web;
- fail-closed do composer permanece;
- ADR 0014.

Cloud Quality: run `36428465564` — SUCCESS.

### PR #54 — Persistência de workspace preparada

Merge: `382e9d48d1e07c06c9c3cfbcb429799dcccff976`

- Sandbox `createBackup()/restoreBackup()`;
- handle do backup persistido em `WebState`;
- checkpoint após writes controlados/propostas;
- checkpoint explícito;
- readiness no health;
- fail-closed `DISABLED/MISCONFIGURED/READY`;
- ADR 0015 e runbook R2.

Cloud Quality: run `36432491551` — SUCCESS.

Ativação permanece deliberadamente desabilitada até R2/cloud credentials reais existirem.

### PR #55 + #56 — Cloudflare Access JWT

PR #55 merge: `3980fd82a3b926bd3ceb6df9554777601e257a8a`  
PR #56 merge: `528f8d293e7b4bf49e250287a8028f4dbe8bbe78`

- header de email isolado não autoriza;
- JWT Access validado por RS256/JWKS/issuer/AUD/exp/nbf;
- identidade humana e Service Auth normalizadas em principal validado;
- workspace server-side isolado por principal;
- health de auth sem PII;
- Access WebSocket deve proteger hostname público/self-hosted;
- ADR 0016.

Cloud Quality:
- #55 run `36433716347` — SUCCESS;
- #56 run `36434828701` — SUCCESS.

### PR #57 — Web Product Smoke Gate

Merge: `18e0e88d22e372a9d1139a77b348073d906edb9c`

Gate manual contra deployment vivo:
- health;
- workspace;
- write/read/hash;
- checkpoint;
- UI;
- Workers AI;
- modelo;
- Chat/Enviar;
- resposta real;
- WebSocket terminal;
- reload/session recovery.

Cloud Quality: run `36435785308` — SUCCESS.

O live smoke ainda não foi executado porque o deploy está bloqueado pela Issue #53.

### PR #58 — identidade do terminal

Merge: `4cf2660e2cf2f1ca2f5a71fd0f3c551d67b9eca8`

- Web exibe `Shell · Cloudflare Sandbox`;
- Windows preserva `PowerShell · ConPTY`.

Cloud Quality: run `36436368357` — SUCCESS.

## Blockers Web atuais

### #53 — Cloudflare Containers

O build/deploy alcança build, imagem, assets e upload do Worker, mas falha em:
`/accounts/.../containers/me`.

Não remover Sandbox/Containers para obter deploy verde.

A conta deve comprovar:
- Workers/Containers entitlement aplicável;
- account correta;
- API token correto;
- permissões corretas.

### #59 — superfície pública / Access

Antes de produção:
- definir hostname público definitivo;
- proteger o hostname com Access;
- adicionar policy Service Auth para smoke CI;
- decidir/registrar route/custom domain;
- desabilitar ou proteger `workers.dev`;
- tratar Version/Preview URLs;
- provar WebSocket 101 sob Access.

## Gates restantes antes de Web Production

1. Resolver #53.
2. Obter deploy real do exact HEAD.
3. Configurar R2 e ativar `WEB_WORKSPACE_BACKUP_ENABLED=true`.
4. Configurar Access e ativar `WEB_ALLOW_ANONYMOUS=false`.
5. Resolver #59.
6. Executar Web Product Smoke em modo `production_ready=true`.
7. Provar restart/restore real de workspace em novo ciclo de Sandbox.
8. Registrar rollback/observabilidade e candidate exact SHA.
9. Somente então considerar a distribuição Web release-ready.

## Segurança / autoridade

- `Agent != Model != Provider != Runtime != Tool != Skill != Source Repository`.
- descoberta != adoção != aprovação != execução.
- nenhuma source/skill/agent concede runtime authority por existência.
- nenhuma credencial real é versionada.
- nenhum CI verde substitui smoke de produto.
- nenhuma distribuição física bloqueia outra distribuição sem requisito explícito.
