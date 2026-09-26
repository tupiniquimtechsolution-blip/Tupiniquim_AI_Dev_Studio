# Generated Toolbox Snapshots

Este diretório recebe snapshots externos auditáveis gerados por integrações autorizadas.

## Skills.sh Top 500

Arquivos esperados quando a sincronização autenticada estiver disponível:

- `skills-sh-top500-all-time.json`
- `skills-sh-top500-trending.json`

Fonte canônica: `https://skills.sh/api/v1/skills`.

A API exige autenticação OIDC. O Tupiniquim **não inventa nem completa rankings ausentes** quando a credencial externa não está disponível. O script `scripts/sync-skills-sh-top500.ps1` continua responsável pela coleta autenticada e `scripts/validate-skills-snapshot.mjs` valida o snapshot antes de qualquer uso.

Regras:

1. `vercel-labs/skills/find-skills` deve permanecer pinned.
2. ranking/popularidade é apenas metadata de descoberta;
3. snapshot não concede `APPROVED` nem autorização de runtime;
4. cada skill continua subordinada ao Skill Gate;
5. tokens/OIDC nunca são persistidos no snapshot ou no Git;
6. snapshots podem ser atualizados sem alterar o core do registry.
