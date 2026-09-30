# Próxima ação

Atualizado em: 2026-09-30

## Ação imediata — Web Clean Product Experience

1. Abrir PR de `feat/web-clean-product-experience` para
   `integration/ai-lab-toolbox-unified` (não fazer merge sem CI GREEN).
2. Rodar Cloud Quality (lint/typecheck/unit/integration/security/dogfood/build)
   no CI oficial (as suítes que exigem volume F:/segredos não rodam na sandbox).
3. Deploy de preview e `pnpm test:web-smoke` contra a URL real — o spec já
   cobre landing → onboarding → Studio, chat, recovery e terminal-quando-READY.
4. Validar responsividade real em 1440/1280/1024/768/390 e acessibilidade
   (foco visível, drawers com Esc, reduced motion).

## Foco anterior (segue válido)

**Web Phase 2 — conectar e certificar o Tupiniquim Remote Runtime via Cloudflare Tunnel.**

Issue canônica:
#68

## Estado comprovado antes desta fase

- Cloudflare Free deploy GREEN;
- Cloud Quality GREEN;
- Web Product Smoke cloud-only GREEN;
- Workers AI gratuito funcional;
- modelo padrão `@cf/zai-org/glm-4.7-flash`;
- chat e recovery certificados;
- Issue #53 concluída.

## Próxima sequência

### 1. Iniciar Runtime Gateway no Windows

Com o repositório local atualizado:

`pnpm runtime:gateway`

Confirmar:
- health local;
- workspace confinement;
- runtime status;
- nenhuma exposição de shell fora das políticas.

### 2. Publicar por Cloudflare Tunnel

Objetivo:
- expor somente o Runtime Gateway;
- HTTPS/WSS;
- sem abrir portas no roteador;
- sem Cloudflare Containers pagos.

### 3. Configurar o Web

Configurar:
- `WEB_REMOTE_RUNTIME_ENABLED=true`;
- URL HTTPS/WSS do gateway;
- identidade/token sem hardcode.

### 4. Reexecutar Web Product Smoke

Certificar:
- workspace list/read/write;
- Git;
- terminal;
- comando real;
- build/test;
- recovery;
- runtime OFFLINE quando gateway cair;
- chat Workers AI continua funcional independentemente do gateway.

## Não fazer

- não reintroduzir Containers pagos;
- não expor shell público irrestrito;
- não versionar tokens;
- não mascarar runtime offline como READY.
