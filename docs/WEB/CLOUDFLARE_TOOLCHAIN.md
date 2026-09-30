# Cloudflare Toolchain Policy

Política determinística de toolchain e dependências Cloudflare do
Tupiniquim Dev AI Studio. Arquitetura **zero-cost** canônica:

```
Browser
→ Cloudflare Worker / Assets
→ Workers AI
→ Durable Objects
→ Cloudflare Tunnel
→ Tupiniquim Remote Runtime local
```

## Runtime permitido

- Workers **Free**
- Workers AI
- Durable Objects
- Assets
- R2 (opcional, para backup de workspace)
- Cloudflare Tunnel
- Tupiniquim Remote Runtime local

## Explicitamente proibido como requisito

- **Cloudflare Containers (pago)** — sem bindings, sem pacote npm.
- **Cloudflare Sandbox (pago)** — pacote `@cloudflare/sandbox` removido;
  a classe `Sandbox` em `apps/web-runtime/src/worker-full.ts` existe apenas
  para compatibilidade da migration histórica `web-sandbox-v1` e responde
  `410 SANDBOX_RETIRED`.
- Qualquer fallback que exija plano pago.

## Toolchain pinada

| Ferramenta | Versão | Fonte |
|---|---|---|
| Node | 24 | `engines.node >=24.0.0` + `setup-node` nos workflows |
| pnpm | 11.16.0 | `packageManager` no `package.json` |
| Wrangler | **4.144.0** (exata) | `devDependencies` + lockfile |
| wrangler-action | v4.1.3 | pin por commit `953926a2e2182532811c01a25e53647d93bf07c0` |

## Política

- **Versões exatas** para tooling de deploy — nunca `^`, `~`, `latest`,
  `4` ou `4.x`.
- Upgrades de toolchain **somente via PR isolado** (nunca junto de feature).
- Lockfile obrigatório: CI instala com `pnpm install --frozen-lockfile`.
- **Nenhum `npx --yes`/`npx latest` em CI**: todo comando Wrangler é
  `pnpm exec wrangler ...` (instalação local do lockfile). A wrangler-action
  usa `packageManager: pnpm` e reutiliza essa mesma instalação — o
  `package.json` é a fonte única da versão (sem `wranglerVersion` duplicado
  no workflow).
- GitHub Actions de terceiros para deploy: **pin por SHA imutável** com
  comentário `# vX.Y.Z`.
- **Nenhum secret em Git** — `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`
  vivem em GitHub Secrets; scripts npm nunca embutem token.
- `compatibility_date` é **contrato de runtime**, não versão de dependência:
  tratada separadamente, só muda com razão técnica comprovada e teste.
- Migrations históricas de Durable Objects (ex.: `web-sandbox-v1`) **não são
  removidas** — histórico de migration ≠ runtime ativo.
- Rollback: por commit + lockfile (o par define a toolchain inteira).
- CI e máquina local usam o **mesmo** Wrangler (`pnpm exec wrangler`).

## Comandos canônicos

```bash
pnpm run cloudflare:check:web            # dry-run do Worker web (wrangler.jsonc)
pnpm run cloudflare:check:control-plane  # dry-run do control plane (cloudflare/wrangler.jsonc)
pnpm run cloudflare:deploy:web           # deploy do Worker web (exige credenciais fora do Git)
pnpm exec wrangler --version             # deve imprimir 4.144.0
```

Regressão automatizada: `tests/unit/cloudflare-toolchain.test.ts`.
