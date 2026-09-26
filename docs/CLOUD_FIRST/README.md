# Cloud-First Operating Model

## Authority

GitHub is the source of truth for code, plans, evidence metadata, CI and checkpoints. The Windows RC1 in PR #32 remains a preserved certification track and is not treated as GREEN until real Windows evidence proves it.

The cross-platform mapping for Master Waves 0–5 is defined in `docs/CLOUD_FIRST/MASTER_WAVE_INFRASTRUCTURE.md` and machine-readable metadata lives in `.agent/CLOUD_MATRIX.json`.

## Release states

- `CLOUD-GREEN`: cloud-compatible quality gates pass on GitHub Actions and cloud integration configuration is valid.
- `WINDOWS-DEFERRED`: Windows-only certification (Electron package, ConPTY, local Ollama/hardware and human OAuth flows) is still pending and must not be reported as passed.
- `RELEASE-GREEN`: cloud gates and the required final Windows certification are both evidenced.

Master Waves may proceed after the preceding wave is `CLOUD-GREEN`; a production release still requires `RELEASE-GREEN` when Windows-specific requirements apply.

## Execution topology

1. ChatGPT coordinates and audits.
2. GitHub stores code, plans, PRs, workflow definitions and evidence artifacts.
3. GitHub Actions performs repeatable cloud and Windows certification jobs.
4. Cloudflare hosts the cloud control-plane/preview. It does not emulate Electron, ConPTY or a local Ollama runtime.
5. Supabase is an optional project-scoped platform integration. It is not a global dependency and must use a dedicated/explicit project reference.
6. Google Drive archives inputs, research, evidence, builds, imports and handoffs, but is not a second editable source of truth.

## Google Drive

The real Drive workspace is already created under `Tupiniquim AI Dev Studio/` with:

- `00_CANONICAL`
- `01_INBOX_UPLOADS`
- `02_MASTER_WAVES`
- `03_EVIDENCE`
- `04_BUILDS_RELEASES`
- `05_DATA_IMPORTS`
- `06_HANDOFFS`
- `07_ARCHIVE`

`02_MASTER_WAVES` contains MW0–MW5 and each wave contains `00_INPUTS`, `01_RESEARCH`, `02_EVIDENCE`, `03_ARTIFACTS` and `04_HANDOFF`. Drive folder IDs are intentionally not committed to the public repository.

## Workflows

- `.github/workflows/cloud-quality.yml` — canonical cloud quality gate and dry-run validation for preview + MW0–MW5 Cloudflare environments.
- `.github/workflows/master-wave-gate.yml` — reusable/manual gate for one explicit Master Wave.
- `.github/workflows/cloudflare-preview.yml` — explicit deploy target `preview` or `mw0`–`mw5`.
- `.github/workflows/supabase-readiness.yml` — remote Supabase readiness/lint only; applies no DDL.
- `.github/workflows/windows-certification.yml` — separate Windows certification track.

## Secrets

Never commit secret values. Repository/environment secrets expected by optional workflows:

### Cloudflare
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Use a least-privilege token scoped to the Tupiniquim Worker/account. Cloudflare deployment uses GitHub Environment `cloud-preview`.

### Supabase
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

Use GitHub Environment `supabase-dev`. No existing Supabase project is selected implicitly and readiness does not execute `db push`, remote reset or schema mutation.

## Gates

Cloud gate:

- install with frozen lockfile
- lint
- typecheck
- unit
- integration
- security
- build
- Cloudflare configuration dry-run for default preview and every Master Wave environment

Windows certification remains explicit/manual in Actions until it is stable enough to become a required release workflow.

## Non-goals

- Do not claim Cloudflare executes Electron/ConPTY.
- Do not treat a browser preview as Windows certification.
- Do not copy development ownership from GitHub to Google Drive.
- Do not merge PR #32 as a side effect of cloud migration.
- Do not reuse unrelated Supabase projects without an explicit decision.
