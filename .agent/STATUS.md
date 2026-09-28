# Status

Atualizado em: 2026-09-28

## Estado operacional atual

- Estratégia: **CLOUD-FIRST / ZERO-COST-FIRST**, com GitHub como fonte de verdade.
- Branch canônica: `integration/ai-lab-toolbox-unified`.
- HEAD operacional auditado: `d0b59c5ece7f001667e2318833d65915e36dccae`.
- Cloudflare Containers pagos foram removidos da arquitetura Web.
- Cloudflare Free hospeda UI/Worker/Workers AI/Durable state.
- Execução de SO é fornecida pelo **Tupiniquim Remote Runtime** opcional no hardware do usuário.
- Modelo Web padrão gratuito: `@cf/zai-org/glm-4.7-flash`.

## Estado por camada

### Código
**GREEN**

### CI
**GREEN**

Cloud Quality permanece GREEN no fluxo de integração.

### Deploy Cloudflare
**GREEN**

O blocker antigo `/containers/me` foi eliminado.

Evidência recente:
- Workers Build do SHA `d0b59c5ece7f001667e2318833d65915e36dccae`: **SUCCESS**
- Build ID: `7f4a7a95-3cca-471a-8d5f-456f04298186`
- Version ID: `c6500336-9110-479a-ab59-4435b1c41bdc`

### Web Product Smoke
**AUTOMAÇÃO FUNCIONAL / TARGET BLOQUEADO POR URL AUSENTE**

Workflow:
`.github/workflows/web-product-smoke.yml`

Gatilho canônico:
- push em `integration/ai-lab-toolbox-unified`;
- execução manual opcional.

Evidência:
- run `36477142690` disparado por push;
- job `smoke-target`: FAIL/BLOCKED;
- motivo: `WEB_SMOKE_BASE_URL` vazio;
- `live-web-smoke`: SKIPPED por dependência do target.

Isso não é falha de produto nem de build. É ausência do hostname público real no GitHub.

### Remote Runtime
**IMPLEMENTADO / NÃO CONFIGURADO**

Capacidades quando conectado:
- workspace;
- filesystem;
- Git;
- terminal;
- build;
- testes;
- persistência local.

Sem gateway conectado:
- chat/Workers AI continuam disponíveis;
- capacidades de SO ficam explicitamente offline/fail-closed.

## Próximo gate único

Registrar uma URL pública real HTTPS em:

`vars.WEB_SMOKE_BASE_URL`

ou informar `base_url` manualmente ao workflow.

Depois disso o smoke deve provar:
1. `/api/health`;
2. `runtime=cloudflare-edge`;
3. `ai=workers-ai`;
4. provider `cloudflare-workers-ai`;
5. modelo padrão `@cf/zai-org/glm-4.7-flash`;
6. chat real;
7. resposta real;
8. reload/recovery;
9. capacidades de SO offline enquanto Remote Runtime não estiver conectado.

## Classificação atual

- CODE: GREEN
- CI: GREEN
- CLOUDFLARE DEPLOY: GREEN
- CONTAINERS PAID: REMOVIDO
- LIVE WEB SMOKE: BLOCKED — PUBLIC URL NOT REGISTERED
- REMOTE RUNTIME: IMPLEMENTED / NOT CONFIGURED
- NOVA MENSALIDADE OBRIGATÓRIA: ZERO dentro das franquias Free
