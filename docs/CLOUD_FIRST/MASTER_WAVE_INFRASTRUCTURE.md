# Master Wave Infrastructure — Cloud-first

Este documento materializa a ambientação transversal das Master Waves 0–5. GitHub continua sendo a fonte de verdade. Google Drive é acervo/evidência; Cloudflare é control-plane/preview; Supabase é plataforma opcional e só pode ser vinculada após seleção explícita de projeto.

## Google Drive

Raiz lógica: `Tupiniquim AI Dev Studio/`

- `00_CANONICAL/` — documentos canônicos exportados, snapshots e referências aprovadas.
- `01_INBOX_UPLOADS/` — entrada temporária para arquivos enviados pelo usuário antes da classificação.
- `02_MASTER_WAVES/` — uma pasta por Master Wave.
- `03_EVIDENCE/` — evidências transversais e pacotes de CI/release.
- `04_BUILDS_RELEASES/` — builds, candidates e releases; não é fonte de código.
- `05_DATA_IMPORTS/` — knowledge packs, datasets e imports antes de ingestão.
- `06_HANDOFFS/` — handoffs consolidados entre waves/agentes.
- `07_ARCHIVE/` — material obsoleto preservado por rastreabilidade.

Cada Master Wave contém exatamente:

1. `00_INPUTS/`
2. `01_RESEARCH/`
3. `02_EVIDENCE/`
4. `03_ARTIFACTS/`
5. `04_HANDOFF/`

IDs de pastas do Drive não são versionados no repositório público.

## Master Waves

| Wave | Drive | Cloudflare env | Estado operacional |
|---|---|---|---|
| MW0 | `MW0_Foundation_Trusted` | `mw0` | concluída |
| MW1 | `MW1_Dev_AI_Local_Autonomous_RC1` | `mw1` | RC1 aberta / Windows deferred |
| MW2 | `MW2_Research_Knowledge_Registries` | `mw2` | autorizada em trilha cloud |
| MW3 | `MW3_Dev_Studio_Hardening_Dogfood` | `mw3` | pendente após MW2 cloud-green |
| MW4 | `MW4_AI_Studio_Agent_Registry` | `mw4` | pendente |
| MW5 | `MW5_Multimodal_Automation_Voice` | `mw5` | pendente |

## GitHub

- branch de fundação cloud: `cloud/master-wave-2-foundation`;
- PR cloud foundation: #33;
- RC1 Windows preservada: branch `arena/01a0c8ba-tupiniquim-ai-dev-studio`, PR #32;
- branches futuras devem nascer somente do checkpoint aprovado da wave anterior, usando `cloud/mw<N>-<scope>`;
- não pré-criar branches funcionais de waves futuras para evitar baseline obsoleto;
- cada wave deve executar o reusable/manual `Master Wave Cloud Gate` antes de receber `CLOUD-GREEN`.

## Cloudflare

Cloudflare não certifica Electron, ConPTY, Ollama local nem hardware. Ele hospeda o control-plane/preview e expõe estado operacional sanitizado.

`cloudflare/wrangler.jsonc` define ambientes `mw0`–`mw5`. O workflow `Cloudflare Preview Deploy` aceita o alvo explicitamente e exige somente secrets no GitHub Environment `cloud-preview`:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

O conector Cloudflare pode ser usado quando autenticado; até lá, GitHub Actions é a rota canônica de deploy.

## Supabase

Supabase não é dependência global automática. Um projeto Tupiniquim próprio deve ser selecionado/criado explicitamente antes de qualquer link remoto.

Quando habilitado, configurar no GitHub Environment `supabase-dev`:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

O workflow `Supabase Readiness` inicializa a configuração efêmera quando necessário, faz `supabase link` no runner e executa `supabase db lint --linked`. Nenhum `db push`, reset remoto ou DDL é executado por esse readiness.

Toda tabela em schema exposto deverá usar RLS e qualquer alteração DDL precisa de advisors/review antes de promoção.

## Promoção

- `CLOUD-GREEN`: gates cloud compatíveis e evidence do workflow passam.
- `WINDOWS-DEFERRED`: requisitos que exigem Windows real permanecem explicitamente pendentes.
- `RELEASE-GREEN`: somente depois de cloud + certificações de release aplicáveis.

Nenhuma cópia no Drive, preview Cloudflare ou projeto Supabase substitui GitHub como fonte de verdade.
