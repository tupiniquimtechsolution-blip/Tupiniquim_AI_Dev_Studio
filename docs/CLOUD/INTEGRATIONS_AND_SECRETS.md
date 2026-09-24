# Cloud Integrations and Secrets

Atualizado em: 2026-09-24

## Regra geral

Nenhum secret real entra no repositório, logs, artifacts ou documentação. GitHub é a fonte de verdade de código; provedores externos recebem somente credenciais com o menor escopo possível.

## GitHub Actions

Os workflows cloud usam GitHub-hosted runners e produzem evidência por commit/branch.

Secrets esperados por integração:

### Cloudflare

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Uso: criar/usar o Pages project `tupiniquim-ai-dev-studio` e publicar previews.

Recomendação de token: limitar ao account correto e somente permissões necessárias para Pages/Workers usados pelo projeto.

### Supabase

Para MCP/CI quando houver projeto dedicado:

- `SUPABASE_PROJECT_REF`
- `SUPABASE_ACCESS_TOKEN`

O MCP deve iniciar com `read_only=true` e escopo `project_ref`. Não usar service role no cliente/browser.

Para runtime browser, quando a arquitetura aprovar Supabase:

- URL do projeto e publishable key podem ser expostas apenas conforme o contrato do frontend.
- Secret/service-role key é exclusivamente server-side.

### Google Tasks

- `GOOGLE_TASKS_CLIENT_ID`
- `GOOGLE_TASKS_CLIENT_SECRET`

OAuth humano continua necessário para aceitação real. CI não deve falsificar consentimento de usuário.

## Estado inicial

| Integração | Estado | Observação |
|---|---|---|
| GitHub | CONFIGURED | fonte de verdade e automação |
| GitHub Actions | BOOTSTRAPPING | workflows cloud nesta branch |
| Cloudflare | NOT_CONFIGURED | depende dos dois GitHub Secrets Cloudflare |
| Supabase | NOT_CONFIGURED_FOR_TUPINIQUIM | existem outros projetos na conta, mas nenhum foi reaproveitado |
| Google Tasks | PARTIAL | integração de produto existe; OAuth real continua humano |
| Google Drive | OPTIONAL_BACKUP | não substitui GitHub |
| Windows local | WINDOWS-DEFERRED | reservado para certificação final |

## Supabase MCP

`.mcp.json` usa variáveis de ambiente e nunca contém token literal. O projeto deve ser dedicado ao Tupiniquim antes de habilitar escrita. Em CI, a recomendação inicial é project-scoped + read-only.

## Cloudflare Pages

O workflow `cloudflare-preview.yml`:

1. verifica silenciosamente se os dois secrets existem;
2. se não existirem, registra `NOT_CONFIGURED` sem imprimir valores;
3. tenta criar idempotentemente o projeto Pages;
4. publica `cloud/preview/` na branch atual;
5. usa o deployment como control plane inicial, não como substituto falso do Electron.

## Rotação e incidente

- qualquer secret exposto deve ser revogado/rotacionado imediatamente;
- nunca copiar secrets para issues, PR descriptions ou artifacts;
- logs de readiness registram apenas booleanos `configured/not_configured`;
- produção futura deve separar credenciais preview/staging/prod.
