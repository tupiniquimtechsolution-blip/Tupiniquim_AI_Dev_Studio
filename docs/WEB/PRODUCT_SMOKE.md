# Web Product Smoke Gate

Status: FUNCTIONAL SMOKE GREEN / PRODUCTION-READY GATE PENDENTE  
Data: 2026-09-30

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
- Remote Runtime `READY`, configurado e online;
- capability `local-persistence` anunciada pelo gateway;
- `workspacePersistence.state=READY`;
- `workspacePersistence.configured=true`;
- checkpoint local real retornando `SNAPSHOT`.

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

O terminal usa `/ws/terminal`. A configuração Access deve proteger todas as superfícies públicas do Worker usadas em produção e smoke, incluindo workers.dev/previews quando permanecerem habilitados. O gate deve ser comprovado no estado atual da conta Cloudflare.

## Como executar

### Automático

O gatilho canônico para a branch ativa é `push` em
`integration/ai-lab-toolbox-unified`.

Isso evita depender de `workflow_run` em um workflow que ainda não existe no
branch padrão `main`.

Cada novo SHA da integração dispara o Web Product Smoke diretamente. O job:

- resolve `vars.WEB_SMOKE_BASE_URL`;
- falha explicitamente como `LIVE_WEB_SMOKE_BLOCKED` se a URL não existir;
- espera `/api/health`;
- executa Playwright no exact SHA;
- publica evidência.

O gatilho `workflow_run` permanece compatível para o futuro, quando esses
workflows forem promovidos ao branch padrão.

### Manual

GitHub Actions → **Web Product Smoke** → Run workflow:

- `base_url`: opcional; se vazio usa `vars.WEB_SMOKE_BASE_URL`;
- `production_ready=false`: diagnóstico funcional;
- `production_ready=true`: gate de produção.

O modo manual também espera o deployment responder em `/api/health` antes de
instalar Chromium e iniciar Playwright.

## O que este gate ainda não prova sozinho

No modo funcional cloud-only, o runtime executável é opcional. Para `production_ready=true`, o Remote Runtime deve estar READY e a persistência local precisa passar checkpoint/restore real. R2 permanece extensão opcional de redundância e não participa desse PASS.

## Blockers atuais para production-ready

O smoke funcional público já está GREEN. Restam: Cloudflare Access em modo produção, Remote Runtime via Tunnel estável, checkpoint/restore local real e execução do smoke com `production_ready=true`.
