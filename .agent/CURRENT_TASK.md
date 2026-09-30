# Tarefa atual

Atualizado em: 2026-09-30

## Tarefa concluída nesta sessão — Web Clean Product Experience

Branch: `feat/web-clean-product-experience`.

Entregue: landing pública, onboarding conversacional multi-step e Studio Web
chat-first com progressive disclosure (drawers para Arquivos/Terminal/Git/
Atividade, Control Center e workbench completo preservados). Guardas fail-closed
Issue #25 compartilhadas em `agentGating.ts`. Smoke Web atualizado
semanticamente (entrada via landing → "Abrir Studio"). Ver
`docs/WEB/PRODUCT_EXPERIENCE.md` e ADR 0018.

Pendente desta fase: abrir PR, rodar Cloud Quality + Web Product Smoke no CI
contra deployment real e validar visualmente nos breakpoints certificados.

## Objetivo (fase anterior — segue válido)

Conectar e certificar o **Tupiniquim Remote Runtime** no Web Free já certificado.

## Fonte de verdade

- Branch: `integration/ai-lab-toolbox-unified`
- Issue: #68
- URL Web: `https://tupiniquim-dev-ai-web.tupiniquim-techsolution.workers.dev`
- Smoke workflow: `.github/workflows/web-product-smoke.yml`

## Estado de entrada

Candidato cloud-only:
`aee4814bf6e8fecdf1bbcc74cff16e7b62c374bb`

Evidência:
- Cloud Quality: GREEN;
- Workers Build: GREEN;
- Live Web Smoke: GREEN;
- chat/recovery: PASS;
- Remote Runtime test: SKIPPED por gateway não configurado.

## Trabalho atual

### Runtime Gateway
- iniciar localmente no Windows;
- validar health;
- validar confinement;
- validar identidade/token.

### Cloudflare Tunnel
- publicar gateway em hostname HTTPS/WSS;
- não abrir portas;
- manter custo obrigatório zero.

### Web
- ativar `WEB_REMOTE_RUNTIME_ENABLED`;
- configurar URL/token do gateway;
- refletir READY/OFFLINE corretamente.

### Certificação
Reexecutar smoke com:
- workspace;
- filesystem;
- Git;
- terminal;
- build/test;
- recovery;
- fail-closed offline.

## Definition of Done

- Remote Runtime conectado;
- Web reconhece READY;
- capacidades de SO passam no smoke;
- queda do gateway produz OFFLINE/fail-closed;
- chat cloud continua funcionando;
- Cloud Quality permanece GREEN;
- Web Product Smoke permanece GREEN;
- Issue #68 fechada com evidência em exact SHA.
