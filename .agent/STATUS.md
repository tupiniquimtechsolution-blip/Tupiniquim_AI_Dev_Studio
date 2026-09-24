# Status

Atualizado em: 2026-09-24

## Estado atual

- Estratégia operacional: **CLOUD-FIRST**.
- GitHub: fonte de verdade e ambiente canônico de desenvolvimento/CI/checkpoints.
- Branch de ambientação cloud: `cloud/master-wave-2-foundation`.
- Base da branch cloud: `9e9840a38a05d1989effe91134f6329abae507aa`.
- PR #32 / branch `arena/01a0c8ba-tupiniquim-ai-dev-studio`: preservado como trilha RC1 Windows, **DRAFT / NÃO MERGEADO / WINDOWS-DEFERRED**.
- `package:win` chegou a PASS no Windows físico após instalação das bibliotecas Spectre; RC1 completa ainda não foi declarada GREEN.
- Master Wave 2: **AUTORIZADA NA TRILHA CLOUD**, condicionada aos gates `CLOUD-GREEN` da fundação cloud-first.
- Cloudflare: control-plane/preview preparado por workflow; não substitui Electron/ConPTY/Ollama local.
- Supabase: integração preparada por contrato/secrets, sem projeto existente selecionado implicitamente.
- Google Drive: destino opcional de arquivo/evidência; não é fonte de verdade.

## Estados formais

- `CLOUD-GREEN`: gates cloud compatíveis passam no GitHub Actions.
- `WINDOWS-DEFERRED`: certificação Windows real permanece pendente.
- `RELEASE-GREEN`: cloud + certificações obrigatórias de release comprovadas.

## Master Waves

- Master Wave 0: CONCLUÍDA.
- Master Wave 1: trilha cloud em consolidação; RC1 Windows preservada como `WINDOWS-DEFERRED`.
- Master Wave 2: próxima trilha funcional, autorizada após ambientação cloud `CLOUD-GREEN`.
- Master Waves 3–5: seguem a ordem do `MASTER_PLAN.md` e só avançam após o gate cloud da anterior.

## Infraestrutura cloud-first

Arquivos canônicos:
- `docs/CLOUD_FIRST/README.md`
- `.github/workflows/cloud-quality.yml`
- `.github/workflows/cloudflare-preview.yml`
- `.github/workflows/windows-certification.yml`
- `cloudflare/wrangler.jsonc`
- `cloudflare/src/index.ts`

Secrets esperados quando a integração for ativada:
- Cloudflare: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- Supabase: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`.

Nenhum secret real deve ser versionado.

## Próximo passo

1. Abrir PR DRAFT da branch `cloud/master-wave-2-foundation` contra a branch RC1 canônica, sem merge automático.
2. Executar `Cloud Quality Gate` e corrigir somente failures comprovados.
3. Quando `CLOUD-GREEN`, iniciar os incrementos funcionais da Master Wave 2.
4. Configurar Cloudflare secrets e disparar deploy manual do control-plane/preview quando as credenciais estiverem disponíveis.
5. Selecionar/criar explicitamente um projeto Supabase próprio antes de qualquer schema ou runtime Supabase do Tupiniquim.
6. Manter a certificação Windows como gate independente de release, sem exigir uso contínuo do PC durante desenvolvimento.
