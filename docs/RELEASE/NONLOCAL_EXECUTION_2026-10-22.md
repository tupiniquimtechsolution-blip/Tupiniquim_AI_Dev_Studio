# Nonlocal completion ledger — 2026-10-22

Scope: complete all tasks executable without installing/running the application
on the owner's machine. CI dependencies and tests run on GitHub-hosted runners.
Production, credential and physical acceptance gates remain distinct. This ledger
must not be used to claim 100% of V1 or RELEASE_GREEN while any required gate lacks proof.

| Work package | Execution / acceptance | State |
| --- | --- | --- |
| Hosted UI proof | Real ephemeral Worker, Durable Object and Runtime Gateway in CI; keyboard/modal/responsive/files/search/diff/save; artifacts | IMPLEMENTED, CI PENDING |
| Workers AI missing binding | Explicit ERROR/not-configured; no simulated inference | IMPLEMENTED, CI PENDING |
| Files creation | Approved plan/effect, create-only atomic operation, no overwrite; negative tests | PENDING |
| Prompt Architect | Immutable versions, strict compile/lint/export/compare, actual UI and persistence | PENDING |
| Preferences | Configurable/persisted shortcuts, validation and conflict handling | PENDING |
| Evidence UI | Display actual runner records; unavailable capabilities remain unavailable | PENDING |
| Toolbox audit | Source/licence/hashes of versioned packs; reconcile historical branches without bulk merges | PENDING |
| Documentation/Agenor | Reconcile per-task scope and exact-SHA evidence; no unearned completion | IN PROGRESS |

External dependencies (not completed): physical Windows/ConPTY/package/provider
dogfood, human Google OAuth, real Workers AI credential/inference where required,
Access/production deployment, real runtime host/tunnel, independent approval and
live exact-deployment smoke. Existing PR #88 is separate; no production merge here.

Hosted Web UI uses `wrangler.hosted-ui.jsonc` only with `wrangler dev --local`.
The synthetic token is a public, loopback-only test fixture, not a credential.
No AI binding, external cloud setup, paid inference, R2 backup, or production
deployment is used. Browser tests write only to ephemeral runner workspaces.
Missing AI is reported explicitly; these tests do not certify model responses.

No tests, dependency installation, build or app startup executed on the owner's
machine. All evidence must be linked to the new PR head, not inherited from a
previous green SHA.
