# Supabase integration contract

Supabase é uma plataforma opcional por projeto/wave. Não é dependência global automática do Tupiniquim AI Dev Studio.

## Estado atual

Nenhum projeto Supabase remoto está vinculado a este repositório. Projetos Supabase existentes de outros produtos não podem ser reutilizados implicitamente.

## Quando habilitar

1. selecionar ou criar explicitamente um projeto Supabase próprio do Tupiniquim;
2. configurar no GitHub Environment `supabase-dev`:
   - `SUPABASE_ACCESS_TOKEN`
   - `SUPABASE_PROJECT_REF`
   - `SUPABASE_DB_PASSWORD`
3. executar o workflow `Supabase Readiness` para a Master Wave desejada;
4. somente após readiness e decisão arquitetural, inicializar e versionar migrations/schema reais.

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

- validação silenciosa da presença de credenciais;
- setup da CLI;
- `supabase init` efêmero se `config.toml` ainda não existir;
- link ao projeto explicitamente fornecido;
- `supabase db lint --linked --level warning`;
- evidence não sensível como artifact.

Nenhum DDL é aplicado por esse workflow.
