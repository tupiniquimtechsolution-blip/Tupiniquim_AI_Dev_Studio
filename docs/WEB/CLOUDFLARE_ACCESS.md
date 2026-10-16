# Web Full — Cloudflare Access

Status: IMPLEMENTAÇÃO PREPARADA / ATIVAÇÃO CLOUD PENDENTE  
Data: 2026-09-28

## Objetivo

Substituir a confiança em headers de identidade não verificados por validação criptográfica do JWT do Cloudflare Access.

Rotas protegidas pelo runtime:
- `/api/studio`
- `/ws/*`

## Invariantes

- `WEB_ALLOW_ANONYMOUS=true` é somente TEST MODE.
- Produção exige `WEB_ALLOW_ANONYMOUS=false`.
- Header `Cf-Access-Authenticated-User-Email` sozinho não autoriza.
- Produção exige `Cf-Access-Jwt-Assertion` válido.
- O JWT é validado por:
  - assinatura RS256;
  - `kid` presente no JWKS do team domain;
  - issuer;
  - audience;
  - expiração;
  - `nbf`, quando presente;
  - principal de identidade válido.
- Nenhuma claim é confiada antes da validação da assinatura.
- Identidade humana usa `sub` + `email`.
- Service Auth pode emitir JWT com `sub`/email vazios; nesse caso o principal validado é `common_name` (Client ID do service token).

## Configuração necessária

Vars:
- `ACCESS_TEAM_DOMAIN=https://<team>.cloudflareaccess.com`
- `ACCESS_AUD=<Audience Tag da aplicação Access>`
- `WEB_ALLOW_ANONYMOUS=false`

O runtime busca JWKS em:

`<ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs`

e mantém cache em memória por 5 minutos.

## Isolamento por identidade

Após autenticação válida, o workspace efetivo não é o ID client-side puro.

O runtime deriva:

`sha256(issuer + principalNormalizado + clientWorkspaceId)`

onde `principalNormalizado` é:
- `user:<sub>` para identidade humana validada;
- `service:<common_name>` para Service Auth validado.

Isso impede que duas identidades autenticadas com o mesmo client workspace ID compartilhem acidentalmente o mesmo Sandbox/Durable Object.

O email não entra no ID efetivo para evitar exposição direta de PII em nomes de runtime.

## WebSocket / Terminal

A edição Web depende de WebSocket em `/ws/terminal`.

Há um problema documentado no ecossistema Cloudflare em que Access configurado como **Worker destination** pode rejeitar upgrades WebSocket com 403 antes do Worker.

Para o Tupiniquim, o gate operacional deve usar aplicação Access self-hosted apontando para o **hostname público** da aplicação, não a configuração one-click que cria Worker destination, até que essa limitação seja comprovadamente resolvida.

Referência GitHub:
- cloudflare/cloudflare-docs#31885

## Health

`GET /api/health` expõe apenas:
- `ANONYMOUS_TEST`
- `ACCESS_READY`
- `MISCONFIGURED`

e `productionReady: true|false`.

Nunca retorna JWT, email, subject, common_name, audience real ou secrets.

## Gate de ativação

1. Cloudflare Access application criada para o hostname público.
2. Audience Tag configurado em `ACCESS_AUD`.
3. Team domain configurado em `ACCESS_TEAM_DOMAIN`.
4. `WEB_ALLOW_ANONYMOUS=false`.
5. Request sem sessão → Access/login ou 401.
6. JWT adulterado → 403.
7. JWT com AUD incorreto → 403.
8. JWT expirado → 403.
9. JWT humano válido → `/api/studio` funciona.
10. Service Token sob policy `Service Auth` recebe JWT Access válido e funciona sem login humano.
11. Duas identidades/principals com mesmo client workspace permanecem isoladas.
12. Terminal WebSocket autenticado → 101 e sessão funcional.
13. `/api/health.auth.productionReady=true`.

Não promover Auth para PASS antes desse smoke real.
