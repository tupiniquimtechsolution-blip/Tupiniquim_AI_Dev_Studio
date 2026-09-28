# Web Product Smoke Gate

Status: GATE IMPLEMENTADO / DEPLOY CLOUD FREE ATIVO / SMOKE PÚBLICO PENDENTE  
Data: 2026-09-28

## Propósito

Este gate existe para impedir a equivalência incorreta:

`BUILD PASS == PRODUTO FUNCIONA`

Ele roda contra uma URL Web **já implantada** e é separado do Cloud Quality Gate.

## Modos

### Functional smoke

`production_ready=false`

Valida o produto vivo, mas permite estados explicitamente não produtivos:
- Auth pode estar em `ANONYMOUS_TEST`;
- persistência pode estar `DISABLED`.

Mesmo nesse modo, `MISCONFIGURED` falha.

### Production-ready smoke

`production_ready=true`

Exige:
- `auth.state=ACCESS_READY`;
- `auth.productionReady=true`;
- `workspacePersistence.state=READY`;
- `workspacePersistence.configured=true`;
- checkpoint R2 real retornando `SNAPSHOT`.

## Fluxo testado

1. `GET /api/health`.
2. runtime `cloudflare-edge`.
3. AI `workers-ai`.
4. bootstrap de workspace.
5. `workspace.write`.
6. `workspace.read` e hash.
7. checkpoint explícito.
8. browser abre a UI.
9. workspace Web é preparado automaticamente.
10. provider visível = `cloudflare-workers-ai`.
11. modelo padrão/selecionado = identificador `@cf/...`.
12. Chat habilita `Enviar`.
13. turno real chega ao Workers AI e retorna resposta.
14. quando o Remote Runtime estiver READY, WebSocket de terminal executa comando real no gateway local.
15. reload preserva sessão/conversa lógica.

## Access em CI

O workflow aceita secrets:
- `WEB_SMOKE_ACCESS_CLIENT_ID`
- `WEB_SMOKE_ACCESS_CLIENT_SECRET`

Esses valores são enviados ao Cloudflare Access nos headers oficiais:
- `CF-Access-Client-Id`
- `CF-Access-Client-Secret`

A aplicação Access deve possuir policy `Service Auth` para o token.

O Worker não confia nesses dois headers diretamente. Depois que o Access autoriza a chamada, o Worker valida o `Cf-Access-Jwt-Assertion` assinado.

## WebSocket

O terminal usa `/ws/terminal`. A aplicação Access deve apontar para o hostname público/self-hosted e não para Worker destination enquanto a limitação cloudflare/cloudflare-docs#31885 estiver vigente.

## Como executar

### Automático

Defina uma variável de repositório GitHub:

`WEB_SMOKE_BASE_URL=https://<hostname-público>`

Quando o **Cloud Quality Gate** terminar com SUCCESS na branch
`integration/ai-lab-toolbox-unified`, o workflow **Web Product Smoke**
é disparado automaticamente, espera `/api/health` ficar disponível e executa
o smoke funcional contra o exact SHA que acabou de passar pelo gate.

Se `WEB_SMOKE_BASE_URL` não existir, o job fica **SKIPPED**. Isso não conta como
PASS de produto.

### Manual

GitHub Actions → **Web Product Smoke** → Run workflow:

- `base_url`: opcional; se vazio usa `vars.WEB_SMOKE_BASE_URL`;
- `production_ready=false`: diagnóstico funcional;
- `production_ready=true`: gate de produção.

O modo manual também espera o deployment responder em `/api/health` antes de
instalar Chromium e iniciar Playwright.

## O que este gate ainda não prova sozinho

No modo zero-custo, o runtime executável é opcional. Chat/Workers AI devem funcionar sem gateway; filesystem/Git/terminal só recebem PASS quando o Tupiniquim Remote Runtime estiver READY. Persistência local do gateway e eventual R2 devem ser certificadas separadamente.

## Blocker atual

O blocker `/containers/me` foi eliminado pela arquitetura zero-custo. O gate atual é descobrir/usar o hostname público `workers.dev`/Version URL e executar este smoke no exact SHA.
