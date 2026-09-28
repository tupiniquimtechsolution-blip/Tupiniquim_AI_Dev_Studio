# Status

Atualizado em: 2026-09-28

## Estado operacional atual

- Estratégia: **CLOUD-FIRST**, com GitHub como fonte de verdade para código, CI, Issues, PRs, evidências e decisões.
- Branch de integração canônica: `integration/ai-lab-toolbox-unified`.
- HEAD auditado antes deste checkpoint documental: `4cf2660e2cf2f1ca2f5a71fd0f3c551d67b9eca8`.
- Cloud Quality Gate do HEAD: run `36436621157` — **SUCCESS**.
- Web Full está implementado com Workers AI, Sandbox/Containers, Durable Objects, persistência R2 preparada, Cloudflare Access preparado e Product Smoke automatizado.
- O deploy de produção está **BLOCKED por infraestrutura Cloudflare** em `/accounts/<account>/containers/me` — Issue #53.
- Não remover Sandbox/Containers para contornar o blocker.

## Web Full — entregas P0 integradas

- PR #52 — provider/runtime/model separados, Workers AI como provider real, catálogo/default Web, filtragem por runtime e workspace Web auto-bootstrap: **MERGED**.
- PR #54 — backup/restore durável do workspace via R2: **MERGED**.
- PR #55 — validação criptográfica de JWT Cloudflare Access + isolamento por identidade: **MERGED**.
- PR #56 — Service Auth verificado para smoke/CI: **MERGED**.
- PR #57 — Web Product Smoke Gate contra URL implantada: **MERGED**.
- PR #58 — terminal exibe semântica real do runtime Web vs Desktop: **MERGED**.

## Estado por camada

### Código
**GREEN**

### CI
**GREEN**

Gates do HEAD atual:
- lint PASS;
- typecheck PASS;
- unit PASS;
- integration PASS;
- security PASS;
- dogfood PASS;
- build PASS;
- Cloudflare dry-run PASS.

### Deploy
**BLOCKED — CLOUDFLARE ACCOUNT / ENTITLEMENT / CREDENTIAL**

Sintoma:
- build passa;
- imagem Sandbox é construída;
- Worker/assets são uploaded;
- `wrangler deploy` falha ao consultar `/containers/me`.

Issue canônica: #53.

### Persistência R2
**IMPLEMENTADA / CLOUD CONFIG PENDING**

Código e documentação:
- `apps/web-runtime/src/workspace-backup.ts`
- `docs/WEB/WORKSPACE_R2_PERSISTENCE.md`
- ADR 0015

Produção ainda requer:
- bucket;
- credenciais R2;
- vars/secrets;
- `WEB_WORKSPACE_BACKUP_ENABLED=true`;
- teste destrutivo de restore.

### Cloudflare Access
**IMPLEMENTADO / CLOUD CONFIG PENDING**

Código e documentação:
- `apps/web-runtime/src/access-auth.ts`
- `docs/WEB/CLOUDFLARE_ACCESS.md`
- ADR 0016

Produção ainda requer:
- aplicação Access self-hosted;
- Audience;
- Team Domain;
- Service Token para smoke;
- `WEB_ALLOW_ANONYMOUS=false`.

### Product Smoke
**IMPLEMENTADO / WAITING FOR DEPLOYABLE URL**

Workflow:
- `.github/workflows/web-product-smoke.yml`

Documentação:
- `docs/WEB/PRODUCT_SMOKE.md`

## Distribuições

### Web
Prioridade operacional atual.

Status: **CODE GREEN / CI GREEN / DEPLOY BLOCKED BY CLOUDFLARE INFRA**

### Windows/Desktop
Mantém Codex App Server + Ollama, runtime local e certificações específicas.

Status físico/hardware continua separado da Web.

### USB/Portable
Permanece distribuição da mesma plataforma e possui gate físico próprio.

## Invariantes

- Agent != Provider != Runtime != Model != Tool != Skill != Source Repository.
- Build PASS != produto funcional.
- CI GREEN != produção certificada.
- Modelo padrão inicial compatível != fallback automático.
- Nenhuma troca silenciosa de provider/model durante sessão.
- Ações privilegiadas continuam fail-closed sob Policy/Approval/Audit.
- Ausência de ambiente/entitlement/credencial = BLOCKED/NOT_CONFIGURED, nunca PASS fictício.

## Pendência crítica única para avanço Web

Issue #53:

1. Workers Paid ativo na account Cloudflare usada pelo projeto;
2. Containers habilitado/entitled;
3. credencial do Cloudflare Build autorizada para Workers + Containers;
4. deploy do HEAD canônico passar;
5. ativar/configurar R2;
6. ativar/configurar Access;
7. executar Web Product Smoke funcional;
8. executar Web Product Smoke `production_ready=true`;
9. somente então considerar Web production-ready.
