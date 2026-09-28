# Próxima ação

Atualizado em: 2026-09-28

## Foco atual

**Web Full — desbloqueio de produção Cloudflare e certificação funcional real.**

Branch canônica:
`integration/ai-lab-toolbox-unified`

Issue canônica:
#53 — Web P0: Cloudflare Containers entitlement/token blocks production deploy

## Estado já comprovado

- código Web P0 integrado;
- Cloud Quality GREEN;
- Workers AI separado de Ollama;
- modelo Web padrão + catálogo compatível;
- workspace auto-bootstrap;
- persistência R2 implementada;
- Cloudflare Access implementado;
- Service Auth implementado;
- Product Smoke implementado;
- terminal Web alinhado ao runtime real.

## Próxima sequência

### 1. Desbloquear Containers/Sandbox na Cloudflare

Na mesma account usada pelo build:
- confirmar Workers Paid;
- confirmar Containers entitlement;
- confirmar credencial do build;
- rerodar `wrangler deploy --config wrangler.jsonc`.

Critério:
`/containers/me` não pode falhar.

### 2. Ativar persistência R2

Seguir `docs/WEB/WORKSPACE_R2_PERSISTENCE.md`.

Não ativar `WEB_WORKSPACE_BACKUP_ENABLED=true` sem bucket, vars e secrets completos.

### 3. Ativar Cloudflare Access

Seguir `docs/WEB/CLOUDFLARE_ACCESS.md`.

Produção exige:
`WEB_ALLOW_ANONYMOUS=false`.

### 4. Executar Product Smoke

Workflow:
`Web Product Smoke`

Primeiro:
`production_ready=false`

Depois da configuração R2 + Access:
`production_ready=true`

### 5. Promover somente com evidência

Não declarar Web production-ready enquanto faltar qualquer um:
- deploy real;
- chat Workers AI;
- workspace;
- editor;
- terminal;
- checkpoint R2;
- auth Access;
- reload/recovery;
- smoke GREEN.

## Trilhas independentes

Windows/USB físico permanecem certificados por gates próprios e não bloqueiam a publicação Web quando os gates Web estiverem GREEN.
