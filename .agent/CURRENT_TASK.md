# Tarefa atual

Atualizado em: 2026-09-28

## Objetivo

Levar a edição **Tupiniquim Dev AI Web Full** do estado:

`CODE/CI GREEN + CLOUD DEPLOY BLOCKED`

para:

`DEPLOY REAL + PRODUCT SMOKE GREEN + PRODUCTION-READY`

sem remover Sandbox/Containers nem mascarar ausência de infraestrutura.

## Fonte de verdade

- Branch: `integration/ai-lab-toolbox-unified`
- Issue: #53
- GitHub Actions: Cloud Quality Gate
- Product Smoke: `.github/workflows/web-product-smoke.yml`

## Estado implementado

PRs integrados:
- #52 provider/runtime/model + workspace bootstrap
- #54 R2 backup/restore
- #55 Cloudflare Access JWT
- #56 Service Auth
- #57 Product Smoke
- #58 terminal runtime

## Blocker atual

Cloudflare deploy falha em:

`/accounts/<account-id>/containers/me`

Classificação:
**INFRASTRUCTURE / ENTITLEMENT / CREDENTIAL**

O build e o código não devem ser degradados para evitar este gate.

## Critério de execução

### Infra
- Workers Paid confirmado;
- Containers entitlement confirmado;
- credencial CI/build válida;
- deploy completo.

### R2
- bucket configurado;
- secrets/vars configurados;
- checkpoint real;
- restore após lifecycle/restart comprovado.

### Access
- aplicação self-hosted;
- AUD/Team Domain configurados;
- Service Auth configurado;
- anonymous desativado em produção;
- WebSocket autenticado funcional.

### Produto
Product Smoke deve provar:
1. health;
2. workspace bootstrap;
3. Workers AI/provider/model;
4. chat real;
5. workspace read/write;
6. terminal real;
7. checkpoint;
8. reload/recovery;
9. auth/persistência production-ready quando aplicável.

## Definition of Done

A tarefa só termina quando:
- Cloud Quality permanece GREEN;
- deploy Cloudflare passa;
- Web Product Smoke funcional passa;
- Web Product Smoke production-ready passa;
- Issue #53 é fechada com evidência;
- documentação operacional registra URL, SHA e gates;
- limitações restantes ficam explícitas.
