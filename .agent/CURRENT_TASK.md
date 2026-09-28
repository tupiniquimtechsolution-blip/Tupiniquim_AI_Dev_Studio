# Tarefa atual

Atualizado em: 2026-09-28

## Objetivo

Levar o Tupiniquim Dev AI Web Free de:

`DEPLOY GREEN / SMOKE BLOCKED BY PUBLIC URL`

para:

`LIVE WEB SMOKE GREEN`

sem custo recorrente obrigatório novo.

## Fonte de verdade

- Branch: `integration/ai-lab-toolbox-unified`
- Issue: #53
- Workflow: `.github/workflows/web-product-smoke.yml`

## Arquitetura atual

Cloudflare Free:
- Worker;
- Assets;
- Workers AI;
- Durable state.

Runtime opcional:
- Tupiniquim Remote Runtime no hardware do usuário.

Modelo padrão:
`@cf/zai-org/glm-4.7-flash`

## Blocker atual

A URL pública real do Worker ainda não está registrada em:

`vars.WEB_SMOKE_BASE_URL`

Evidência:
- Web Product Smoke run `36477142690`;
- `smoke-target` falhou corretamente;
- erro: `LIVE_WEB_SMOKE_BLOCKED`;
- Workers Build do mesmo SHA ficou GREEN.

## Definition of Done desta tarefa

- hostname público real registrado;
- health passa;
- UI abre;
- provider/model corretos;
- chat real passa;
- resposta Workers AI passa;
- reload/recovery passa;
- capacidades Remote Runtime ficam explicitamente OFFLINE quando não configuradas;
- Issue #53 atualizada com exact SHA, URL e evidências.

A conexão do Runtime Gateway local é fase seguinte e independente do smoke cloud-only.
