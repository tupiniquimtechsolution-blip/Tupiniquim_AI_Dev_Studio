# Status

Atualizado em: 2026-09-29

## Estado operacional atual

- Estratégia: **CLOUD-FIRST / ZERO-COST-FIRST**, com GitHub como fonte de verdade.
- Branch canônica: `integration/ai-lab-toolbox-unified`.
- Candidato Web cloud-only certificado: `aee4814bf6e8fecdf1bbcc74cff16e7b62c374bb`.
- URL pública: `https://tupiniquim-dev-ai-web.tupiniquim-techsolution.workers.dev`.
- Cloudflare Containers pagos foram removidos da arquitetura Web.
- Cloudflare Free hospeda UI/Worker/Workers AI/Durable state.
- Execução de SO é fornecida pelo **Tupiniquim Remote Runtime** opcional no hardware do usuário.
- Modelo Web padrão gratuito: `@cf/zai-org/glm-4.7-flash`.

## Estado por camada

### Código
**GREEN**

### CI
**GREEN**

Cloud Quality run `36546104298`: **SUCCESS**.

### Deploy Cloudflare
**GREEN**

Workers Build do candidato:
- Build ID: `b75fea78-0569-4237-9c5d-d2dc7ec1c32b`
- Version ID: `7dfdc1aa-90a0-4456-9c44-98a635e1e929`
- conclusão: **SUCCESS**

### Web Product Smoke
**GREEN — CLOUD-ONLY**

Run:
`36546098267`

Playwright:
- health/functional readiness: PASS;
- UI Web Full + workspace/model bootstrap + chat + session recovery: PASS;
- workspace/R2/Remote Runtime: SKIPPED porque o Remote Runtime ainda não está conectado.

Artifact:
- `web-product-smoke-aee4814bf6e8fecdf1bbcc74cff16e7b62c374bb`
- ID: `11022029029`
- SHA256: `71e70b5556fe2ecc6354c2bac401b9c299b5ba4b7b0ccd1ead417d5390af9a64`

Issue #53 foi encerrada como concluída.

### Remote Runtime
**IMPLEMENTADO / NÃO CONFIGURADO**

Issue canônica da próxima fase:
#68 — conectar e certificar Tupiniquim Remote Runtime via Cloudflare Tunnel.

Capacidades a certificar quando conectado:
- workspace;
- filesystem;
- Git;
- terminal;
- build;
- testes;
- recovery;
- fail-closed quando runtime estiver offline.

## Classificação atual

- CODE: GREEN
- CI: GREEN
- CLOUDFLARE FREE DEPLOY: GREEN
- LIVE WEB CLOUD-ONLY SMOKE: GREEN
- CONTAINERS PAID: REMOVIDO
- REMOTE RUNTIME: IMPLEMENTED / NOT CONFIGURED
- NOVA MENSALIDADE OBRIGATÓRIA: ZERO dentro das franquias Free
