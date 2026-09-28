# Próxima ação

Atualizado em: 2026-09-28

## Foco atual

**Certificar o Web Free já implantado.**

Branch:
`integration/ai-lab-toolbox-unified`

Issue:
#53

## Estado comprovado

- Containers pagos removidos;
- Workers Build GREEN;
- Cloud Quality GREEN;
- Workers AI gratuito configurado;
- GLM-4.7-Flash como default;
- Remote Runtime implementado;
- Web Product Smoke dispara por push;
- ausência de URL pública agora aparece como blocker explícito.

## Próxima sequência

### 1. Registrar o hostname público

Configurar no GitHub:

`WEB_SMOKE_BASE_URL=https://<hostname-público-real>`

A URL deve ser o workers.dev ou custom domain real do Worker.

Não inventar hostname.

### 2. Reexecutar Web Product Smoke

O próximo push na branch dispara automaticamente.

Também pode ser executado manualmente com `base_url`.

Primeiro:
`production_ready=false`

### 3. Validar o Web cloud-only

Critérios:
- health 2xx;
- UI abre;
- provider correto;
- modelo gratuito correto;
- Enviar habilita;
- Workers AI responde;
- sessão recupera após reload;
- terminal/Git/filesystem aparecem offline quando Gateway não está conectado.

### 4. Conectar Remote Runtime opcional

Depois do smoke cloud-only:
- iniciar `pnpm runtime:gateway` no Windows;
- expor por Cloudflare Tunnel;
- configurar URL/token do gateway;
- repetir smoke com filesystem/Git/terminal/build/test.

## Não fazer

- não reintroduzir Cloudflare Containers;
- não migrar para plano pago;
- não esconder falha de smoke;
- não marcar SKIPPED/BLOCKED como PASS.
