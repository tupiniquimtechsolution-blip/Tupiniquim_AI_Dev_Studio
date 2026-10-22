# Nonlocal completion ledger — 2026-10-22

Scope: complete all tasks executable without installing/running the application
on the owner's machine. CI dependencies and tests run on GitHub-hosted runners.
Production, credential and physical acceptance gates remain distinct. This ledger
must not be used to claim 100% of V1 or RELEASE_GREEN while any required gate lacks proof.

| Work package | Execution / acceptance | State |
| --- | --- | --- |
| Hosted UI proof | Real ephemeral Worker, Durable Object and Runtime Gateway in CI; keyboard/modal/responsive/files/search/diff/save; first run exposed Tab edge and incorrect IME test target, corrected for rerun | SUCCESS at 69fae38; 39770100780 |
| Workers AI missing binding | Explicit ERROR/not-configured; no simulated inference | IMPLEMENTED, CI PENDING |
| Files creation | Approved plan/effect, create-only atomic operation, no overwrite; negative tests | PENDING |
| Prompt Architect | Immutable versions serialized in durable object, strict shared core, full panel + hosted browser test | IMPLEMENTED, CI PENDING |
| Preferences | Configurable/persisted opt-in navigation shortcuts; shared schema/conflict checks; server contrast/import validation and hosted persistence regression | IMPLEMENTED, CI PENDING |
| Evidence UI | Session history/export of actual runner results; truthful unavailable/manual gates and quiet secret scan; new hosted regression | IMPLEMENTED, CI PENDING |
| Toolbox audit | Pinned commits + MIT licences remotely rechecked; current catalog SHA-256 recorded in SOURCE_REAUDIT_2026-10-22.md; original artifacts absent | REFERENCE AUDIT COMPLETE; original archives UNVERIFIED |
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

## First hosted run diagnosis

Cloud Quality `39769250029` SUCCESS at `2f5d46c`; Hosted Web UI `39769250081`
failed. Gateway and Worker started successfully and actual file creation/search/
opening completed. Activity modal Tab reached browser chrome; explicit edge
containment added without changing native modality. The editor test targeted
Monaco's readonly, aria-hidden IME textarea (confirmed in downloaded trace);
the test now clicks the visible text surface and sends normal keystrokes.
Screenshots/traces were inspected locally as artifacts; no tests ran locally.

Web Prompt Architect now uses the shared core in WebState, queues mutations,
retains immutable IDs/versions, rejects missing/unknown variables and provides
validation/compilation/comparison/export through the new panel. Unit regression
includes concurrent versions and object restart; hosted browser regression
covers the end-to-end panel. No earlier lost versions can be reconstructed.
