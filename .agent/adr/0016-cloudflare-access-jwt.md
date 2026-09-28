# ADR 0016 — Cloudflare Access JWT como fronteira de identidade Web

Status: PROPOSTA IMPLEMENTADA / ATIVAÇÃO CLOUD PENDENTE  
Data: 2026-09-28

## Problema

A primeira fronteira Web aceitava `Cf-Access-Authenticated-User-Email` como evidência suficiente de identidade. Isso não fornece validação criptográfica independente no Worker e deixa o runtime dependente de uma configuração externa perfeita.

## Decisão

Quando o modo anônimo de teste estiver desabilitado:

- exigir `Cf-Access-Jwt-Assertion`;
- validar assinatura RS256 com JWKS do team domain;
- validar issuer, audience, expiração e nbf;
- rejeitar email header sem JWT;
- derivar o workspace server-side a partir da identidade validada + ID local do cliente;
- manter modo anônimo somente como estado explícito não-production-ready.

## Operação

Cloudflare Access deve proteger o hostname público para preservar o WebSocket do terminal.

## Consequências

- requer `ACCESS_TEAM_DOMAIN` e `ACCESS_AUD`;
- produção não pode usar `WEB_ALLOW_ANONYMOUS=true`;
- configuração incompleta falha fechado;
- health reporta readiness sem PII;
- o código pode ser integrado antes da ativação, desde que o modo anônimo continue explicitamente marcado como teste.
