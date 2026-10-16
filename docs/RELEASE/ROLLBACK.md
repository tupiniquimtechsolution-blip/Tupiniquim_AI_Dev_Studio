# Rollback

Atualizado em: 2026-09-30. Princípio: commit + lockfile definem a toolchain e o produto inteiros; rollback é sempre por SHA, nunca por edição manual.

## Código / Worker

1. Identificar o último SHA verde (Cloud Quality + Web Product Smoke PASS — ver Actions por branch `integration/ai-lab-toolbox-unified`).
2. `git checkout <SHA> && pnpm install --frozen-lockfile && pnpm build`.
3. `pnpm run cloudflare:check:web` (dry-run) e, com autorização, `pnpm run cloudflare:deploy:web`.
4. Alternativa dashboard: Workers → Deployments → rollback para a versão anterior.

## O que NÃO reverter

- **Migrations de Durable Objects** (`web-sandbox-v1`, `web-full-state-v1`): histórico é contrato; nunca remover/renomear classes/tags sem plano de migração formal.
- **`compatibility_date`**: contrato de runtime — só muda com razão técnica + teste, nunca em rollback.
- **Secrets**: rollback de código não toca secrets; rotação é operação separada no dashboard/wrangler.

## Dados

- Durable Objects: estado por workspace persiste independente do deploy; nenhuma migração destrutiva existe nesta janela.
- R2 (backup de workspace): restauração via fluxo próprio do produto (`workspace-backup.ts`); backups são versionados por nome — não apagar buckets em rollback.

## Toolchain

- Reverter upgrade de Wrangler/action = reverter o commit do pin (PR isolado, política em `docs/WEB/CLOUDFLARE_TOOLCHAIN.md`).

## Validação pós-rollback

Health (§1 do RUNBOOK) + Web Product Smoke (dispatch manual com a URL) — os mesmos gates do release; um rollback sem smoke não é rollback concluído.
