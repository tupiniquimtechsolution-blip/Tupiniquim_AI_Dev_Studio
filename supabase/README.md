# Supabase integration contract

Supabase é uma plataforma opcional por projeto/wave. Não é dependência global automática do Tupiniquim AI Dev Studio.

## Projeto dedicado

- nome: `Tupiniquim-AI-Dev-Studio`
- project ref: `brqokxlmxwyxwwbtsltc`
- URL: `https://brqokxlmxwyxwwbtsltc.supabase.co`
- região: `sa-east-1`
- estado inicial observado: `ACTIVE_HEALTHY`
- advisors iniciais: segurança = 0 achados; performance = 0 achados

Projetos Supabase existentes de outros produtos não podem ser reutilizados implicitamente.

## Estado operacional

O projeto remoto já está provisionado, porém nenhum schema de produto, migration ou Edge Function foi aplicado. O repositório mantém a autoridade sobre qualquer futura mudança de banco.

## Habilitação no CI

Configurar no GitHub Environment `supabase-dev` apenas os secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

O `SUPABASE_PROJECT_REF` não é secret e está fixado no workflow para impedir link acidental a outro projeto.

Depois executar o workflow `Supabase Readiness` para a Master Wave desejada. Somente após readiness e decisão arquitetural, inicializar e versionar migrations/schema reais.

## Regras de segurança

- nunca versionar service role, database password, PAT ou secrets;
- tabelas em schema exposto devem usar RLS;
- autorização não pode confiar em `user_metadata`;
- alterações DDL devem ser versionadas como migrations e passar por review;
- antes de promover DDL, executar advisors de segurança/performance;
- `db reset --linked` é proibido em ambientes persistentes/produção;
- `db push` não faz parte do readiness e exige mudança explicitamente aprovada.

## CI

`.github/workflows/supabase-readiness.yml` faz somente:

- validação da presença das credenciais privadas de CI;
- verificação do project ref canônico `brqokxlmxwyxwwbtsltc`;
- setup da CLI;
- `supabase init` efêmero se `config.toml` ainda não existir;
- link ao projeto dedicado;
- `supabase db lint --linked --level warning`;
- evidence não sensível como artifact.

Nenhum DDL é aplicado por esse workflow.
