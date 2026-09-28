# Web Full — Persistência durável do workspace com R2

Status: IMPLEMENTAÇÃO PREPARADA / ATIVAÇÃO CLOUD PENDENTE  
Data: 2026-09-28

## Objetivo

Persistir `/workspace` entre sleep/restart/substituição de Sandbox sem montar R2 diretamente sobre `/workspace`.

A estratégia segue o Sandbox SDK:

- `sandbox.createBackup({ dir: '/workspace' })`;
- handle serializável persistido no `WebState` (Durable Object);
- `sandbox.restoreBackup(handle)` no bootstrap de um novo runtime;
- `gitignore: true` para evitar caches/artefatos descartáveis quando o repositório os ignora;
- TTL de 7 dias para o backup mais recente;
- marker em `/tmp` para não restaurar repetidamente no mesmo container quente.

## Por que backup/restore

Montar bucket diretamente em `/workspace` cria overlay do diretório e pode esconder arquivos inicializados no filesystem do Sandbox. Para workspace de projeto, backup/restore preserva a semântica atual do runtime e restaura a árvore quando o container reinicia.

## Runtime

Código:
- `apps/web-runtime/src/workspace-backup.ts`
- `apps/web-runtime/src/worker-full.ts`

Ações:
- `full.workspace.bootstrap`: restaura o backup mais recente antes do bootstrap Git.
- `workspace.write`: cria checkpoint depois de escrita controlada.
- `full.planning.apply-proposal`: cria checkpoint depois de materializar proposta.
- `full.workspace.checkpoint`: checkpoint explícito.
- `full.workspace.persistence-status`: readiness da persistência.
- `/api/health`: expõe somente estado/configuração, nunca secret values.

## Fail-closed

`WEB_WORKSPACE_BACKUP_ENABLED=false` mantém a feature explicitamente desativada em ambientes ainda não configurados.

Quando `WEB_WORKSPACE_BACKUP_ENABLED=true`, são obrigatórios:
- `BACKUP_BUCKET_NAME`
- `CLOUDFLARE_ACCOUNT_ID`
- secret `R2_ACCESS_KEY_ID`
- secret `R2_SECRET_ACCESS_KEY`

Se a feature for habilitada sem esse conjunto, o runtime reporta `MISCONFIGURED`.

## Configuração Cloudflare necessária

Criar bucket:

```bash
npx wrangler r2 bucket create tupiniquim-dev-ai-web-workspaces
```

Adicionar binding ao `wrangler.jsonc` quando o bucket existir:

```jsonc
"r2_buckets": [
  {
    "binding": "BACKUP_BUCKET",
    "bucket_name": "tupiniquim-dev-ai-web-workspaces"
  }
]
```

Adicionar vars:
- `WEB_WORKSPACE_BACKUP_ENABLED=true`
- `BACKUP_BUCKET_NAME=tupiniquim-dev-ai-web-workspaces`
- `CLOUDFLARE_ACCOUNT_ID=<account da implantação>`

Adicionar secrets:

```bash
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

O token R2 deve possuir Object Read & Write no bucket de backup.

## Gate de ativação

Não marcar persistência como PASS até comprovar no deploy real:

1. `/api/health` retorna `workspacePersistence.state=READY`;
2. bootstrap sem backup cria/clona `/workspace`;
3. criar/editar arquivo;
4. executar checkpoint;
5. destruir/reiniciar Sandbox;
6. novo bootstrap restaura o backup;
7. arquivo e hash permanecem;
8. sessão lógica do Durable Object permanece consistente;
9. nenhum secret aparece em log/resposta;
10. workspace de um ID não aparece em outro ID.

## Limitação conhecida deste slice

Checkpoint automático cobre escritas controladas pelo Studio e propostas materializadas. Alterações arbitrárias feitas dentro de um terminal ainda exigem checkpoint explícito até existir um hook/lifecycle confiável para capturar a conclusão do comando/sessão.

Isso deve ser tratado como limitação explícita, não como persistência total certificada.
