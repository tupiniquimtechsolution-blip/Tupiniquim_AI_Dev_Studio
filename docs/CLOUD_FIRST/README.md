# Cloud-First Operating Model

## Authority

GitHub is the source of truth for code, plans, evidence metadata, CI and checkpoints. The Windows RC1 in PR #32 remains a preserved certification track and is not treated as GREEN until real Windows evidence proves it.

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
6. Google Drive may archive evidence/builds, but is not a second editable source of truth.

## Secrets

Never commit secret values. Repository/environment secrets expected by optional workflows:

### Cloudflare
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Use a least-privilege token scoped to the Tupiniquim Worker/account.

### Supabase
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`

No existing Supabase project is selected implicitly.

## Gates

Cloud gate:

- install with frozen lockfile
- lint
- typecheck
- unit
- integration
- security
- build
- Cloudflare configuration dry-run

Windows certification remains explicit/manual in Actions until it is stable enough to become a required release workflow.

## Non-goals

- Do not claim Cloudflare executes Electron/ConPTY.
- Do not treat a browser preview as Windows certification.
- Do not copy development ownership from GitHub to Google Drive.
- Do not merge PR #32 as a side effect of cloud migration.
- Do not reuse unrelated Supabase projects without an explicit decision.
