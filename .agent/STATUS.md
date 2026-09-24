# Status

Atualizado em: 2026-09-24

## Estado atual

- Estratégia operacional: **CLOUD-FIRST**.
- GitHub: fonte de verdade e ambiente canônico de desenvolvimento/CI/checkpoints.
- Branch de ambientação cloud: `cloud/master-wave-2-foundation`.
- Base da branch cloud: `9e9840a38a05d1989effe91134f6329abae507aa`.
- PR cloud foundation: #33 — **DRAFT / NÃO MERGEADO**.
- PR #32 / branch `arena/01a0c8ba-tupiniquim-ai-dev-studio`: preservado como trilha RC1 Windows, **DRAFT / NÃO MERGEADO / WINDOWS-DEFERRED**.
- `package:win` chegou a PASS no Windows físico após instalação das bibliotecas Spectre; RC1 completa ainda não foi declarada GREEN.
- Master Wave 2: **AUTORIZADA NA TRILHA CLOUD**, condicionada aos gates `CLOUD-GREEN` da fundação cloud-first.
- Cloudflare: control-plane/preview e ambientes MW0–MW5 versionados; deploy direto pelo conector está aguardando autenticação válida, enquanto GitHub Actions está preparado para deploy por secrets.
- Supabase: projeto dedicado `Tupiniquim-AI-Dev-Studio` provisionado em `sa-east-1`, ref `brqokxlmxwyxwwbtsltc`, estado `ACTIVE_HEALTHY`; advisors iniciais de segurança e performance sem achados; nenhum DDL remoto aplicado.
- Google Drive: workspace real criado e verificado; funciona como acervo/evidência, não como fonte de verdade.

## Estados formais

- `CLOUD-GREEN`: gates cloud compatíveis passam no GitHub Actions.
- `WINDOWS-DEFERRED`: certificação Windows real permanece pendente.
- `RELEASE-GREEN`: cloud + certificações obrigatórias de release comprovadas.

## Master Waves

- Master Wave 0: CONCLUÍDA.
- Master Wave 1: trilha cloud em consolidação; RC1 Windows preservada como `WINDOWS-DEFERRED`.
- Master Wave 2: próxima trilha funcional, autorizada após ambientação cloud `CLOUD-GREEN`.
- Master Waves 3–5: seguem a ordem do `MASTER_PLAN.md` e só avançam após o gate cloud da anterior.

## Google Drive preparado

Raiz: `Tupiniquim AI Dev Studio/`.

Áreas globais verificadas:
- `00_CANONICAL`
- `01_INBOX_UPLOADS`
- `02_MASTER_WAVES`
- `03_EVIDENCE`
- `04_BUILDS_RELEASES`
- `05_DATA_IMPORTS`
- `06_HANDOFFS`
- `07_ARCHIVE`

`02_MASTER_WAVES` contém:
- `MW0_Foundation_Trusted`
- `MW1_Dev_AI_Local_Autonomous_RC1`
- `MW2_Research_Knowledge_Registries`
- `MW3_Dev_Studio_Hardening_Dogfood`
- `MW4_AI_Studio_Agent_Registry`
- `MW5_Multimodal_Automation_Voice`

Cada wave possui `00_INPUTS`, `01_RESEARCH`, `02_EVIDENCE`, `03_ARTIFACTS` e `04_HANDOFF`.

## Infraestrutura cloud-first

Arquivos canônicos:
- `docs/CLOUD_FIRST/README.md`
- `docs/CLOUD_FIRST/MASTER_WAVE_INFRASTRUCTURE.md`
- `.agent/CLOUD_MATRIX.json`
- `.github/workflows/cloud-quality.yml`
- `.github/workflows/master-wave-gate.yml`
- `.github/workflows/cloudflare-preview.yml`
- `.github/workflows/supabase-readiness.yml`
- `.github/workflows/windows-certification.yml`
- `cloudflare/wrangler.jsonc`
- `cloudflare/src/index.ts`
- `supabase/README.md`

Cloudflare / GitHub Environment `cloud-preview`:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Supabase dedicado:
- projeto: `Tupiniquim-AI-Dev-Studio`
- ref público/canônico: `brqokxlmxwyxwwbtsltc`
- URL: `https://brqokxlmxwyxwwbtsltc.supabase.co`
- região: `sa-east-1`
- GitHub Environment: `supabase-dev`
- secrets de CI ainda necessários: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`

Nenhum secret real deve ser versionado.

## Próximo passo

1. Concluir o `Cloud Quality Gate` do PR #33 e corrigir somente failures comprovados.
2. Classificar arquivos enviados para `01_INBOX_UPLOADS` e mover para a Master Wave correta sem alterar a fonte de verdade GitHub.
3. Quando a fundação estiver `CLOUD-GREEN`, iniciar os incrementos funcionais da Master Wave 2.
4. Reautenticar/configurar Cloudflare e executar o deploy explícito de `preview`/MW desejada sem uso do PC.
5. Configurar os dois secrets de CI do ambiente `supabase-dev` e rodar `Supabase Readiness`; schema/migrations só entram depois, versionados e auditados.
6. Manter a certificação Windows como gate independente de release, sem exigir uso contínuo do PC durante desenvolvimento.
