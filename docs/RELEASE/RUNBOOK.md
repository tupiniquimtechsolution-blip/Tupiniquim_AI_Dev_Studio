# Runbook — operação Web + Runtime Local

Atualizado em: 2026-09-30. Nenhum comando aqui contém segredo; valores sensíveis ficam exclusivamente em GitHub Secrets / Wrangler secrets / ambiente local.

## 1. Verificação rápida de saúde

```bash
curl -s https://tupiniquim-dev-ai-web.tupiniquim-techsolution.workers.dev/api/health
```
Campos relevantes: `executionRuntime.state` (DISABLED|MISCONFIGURED|OFFLINE|READY), `workspacePersistence.state`, `auth.productionReady`. Os estados são verdadeiros — nunca mascarados.

## 2. Habilitar o Runtime Local (RG-05) — responsável: operador da conta Cloudflare + dono do host

1. **Host local**: iniciar o gateway (`pnpm runtime:gateway`) e o túnel `cloudflared` apontando para ele. Anotar a URL pública do túnel.
2. **Worker (produção)**:
   - `wrangler.jsonc` → `WEB_REMOTE_RUNTIME_ENABLED: "true"` (via PR) **ou** var no dashboard;
   - var `REMOTE_RUNTIME_URL` = URL do túnel (sem credencial embutida);
   - secret `REMOTE_RUNTIME_TOKEN`: `pnpm exec wrangler secret put REMOTE_RUNTIME_TOKEN --config wrangler.jsonc` (valor nunca em Git/log).
3. **Validar**: health → `executionRuntime.state: "READY"` com `capabilities` (files, git, terminal, gates); na UI, drawer Terminal/Git/Files libera após "Verificar novamente" (sem reload); Toolbox executa gate com PASS/FAIL real.
4. **Reconexão/timeout**: o Worker usa timeout de 3s no health e reporta OFFLINE com detalhe; a UI reconsulta a cada 60s e sob demanda.

## 3. Deploy (somente com autorização)

```bash
pnpm install --frozen-lockfile && pnpm build
pnpm run cloudflare:check:web          # dry-run obrigatório antes
pnpm run cloudflare:deploy:web         # deploy real (credenciais via ambiente)
```
CI equivalente: workflow `Cloudflare Preview Deploy` (action pinada por SHA, Wrangler 4.144.0 do lockfile). Nunca `npx wrangler` flutuante.

## 4. Smoke pós-deploy

Automático: `Web Product Smoke` roda a cada push na `integration/ai-lab-toolbox-unified` contra a URL implantada. Manual: `pnpm test:web-smoke` com `WEB_SMOKE_BASE_URL` apontando para o ambiente (e `WEB_SMOKE_REQUIRE_PRODUCTION_READY=true` quando o Access estiver ativo).

## 5. Gates locais (desenvolvedor)

```bash
export TEMP=/tmp TMP=/tmp TMPDIR=/tmp   # obrigatório fora do Windows
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration \
  && pnpm test:security && pnpm test:dogfood && pnpm build
```
No Windows certificado, `TEMP` deve estar em `F:\` (contrato validado pelos próprios testes).

## 6. Troubleshooting

| Sintoma | Diagnóstico | Ação |
|---|---|---|
| Chat exibe JSON bruto | versão anterior ao PR #80 | atualizar deploy |
| Todos os gates "falham" igual | runtime não-READY (ver health) | seguir §2; a UI indica o estado exato |
| `MISCONFIGURED` | falta `REMOTE_RUNTIME_URL` ou `REMOTE_RUNTIME_TOKEN` | conferir vars/secrets (nomes no detail; valores nunca exibidos) |
| `OFFLINE` | túnel/gateway fora | reiniciar `cloudflared`/gateway; health detail traz HTTP/erro de rede |
| 22 falhas de integration locais | `TEMP` indefinido no shell | exportar TEMP (ver §5) |
