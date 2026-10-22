# Nonlocal completion ledger — 2026-10-22

Scope: complete all tasks executable without installing/running the application
on the owner's machine. CI dependencies and tests run on GitHub-hosted runners.
Production, credential and physical acceptance gates remain distinct. This ledger
must not be used to claim 100% of V1 or RELEASE_GREEN while any required gate lacks proof.

| Work package | Execution / acceptance | State |
| --- | --- | --- |
| Hosted UI proof | Real ephemeral Worker, Durable Object and Runtime Gateway in CI; keyboard/modal/responsive/files/search/diff/save; first run exposed Tab edge and incorrect IME test target, corrected for rerun | SUCCESS @92d05f4; 39826094506 |
| Workers AI missing binding | Explicit ERROR/not-configured; no simulated inference | VALIDATED @92d05f4; scope below |
| Files creation | Manual review + persisted core manifest/ONCE approval, exclusive atomic publication, replay/expiry/path confinement and negative hosted/unit regressions | VALIDATED @92d05f4; scope below |
| Prompt Architect | Immutable versions serialized in durable object, strict shared core, full panel + hosted browser test | VALIDATED @92d05f4; scope below |
| Preferences | Configurable/persisted opt-in navigation shortcuts; shared schema/conflict checks; server contrast/import validation and hosted persistence regression | VALIDATED @92d05f4; scope below |
| Evidence UI | Session observations + up to 100 durable server receipts per workspace, reload/export; truthful unavailable gates and quiet scanner | VALIDATED @92d05f4; scope below |
| Toolbox audit | Pinned commits + MIT licences remotely rechecked; current catalog SHA-256 recorded in SOURCE_REAUDIT_2026-10-22.md; original artifacts absent | REFERENCE AUDIT COMPLETE; original archives UNVERIFIED |
| Terminal sessions | Four panels, explicit manual shell confirmation, gateway resource/time caps, real Linux PTY regression | VALIDATED @92d05f4; Linux scope |
| Visual library | Existing regular files, durable metadata/provenance, declared-license gate, no external transform | VALIDATED @92d05f4; metadata only |
| Git queries | Real NUL status/diff, filenames/rename/conflict/upstream, no hooks/parent discovery | READ VALIDATED @92d05f4; commit/checkpoint/restore PENDING |
| Remaining implementation | Autonomy runtime, browser-second, Preview IPC/UI/package, Composer/continuous ingestion, complete Visual transforms | PENDING; not counted complete |
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

## Remote checkpoint before reviewed creation

Head 21e75fe: Cloud Quality 39775354329 SUCCESS; Hosted Web UI 39775354325 SUCCESS. Includes preferences persistence and server rejection paths, evidence export and truthful unavailable gates. Reviewed CREATE is a later delta requiring its own checks. No production or physical certification implied.

CREATE requires an existing parent directory. Failed/expired reviews require preparing a new review; no automatic overwrite/retry. Gateway path checks assume the host is trusted against concurrent filesystem tampering by another privileged process. Original agent proposal materialization remains a separate path and still needs its own hardening/acceptance; manual CREATE evidence must not certify it.

## Reviewed CREATE and visual follow-up

Cloud Quality 39776027692 SUCCESS @d193ff7. Hosted 39776027695: 5 passed, 1 failed (shortcut invoked after reload before preference hydration). Manual CREATE, refusal to overwrite, and legacy bypass rejection passed in that run. Full hosted certification for this head FAILED; no partial-green relabeling. Startup now exposes aria-busy and the test awaits hydration. Pending next remote run.

Screenshots @21e75fe inspected at 390/1440. Added clear/dark evidence at four widths plus mobile panels. Corrected new form styles and Control Center light-theme evidence contrast. Browser history cancellation now uses a shared leave guard, preserves the Studio and restores known SPA history positions; hosted regression added. Unknown external history entries use conservative current-route restoration; external document unload remains browser-controlled.

## Write/approval follow-up

Gateway compare-and-write is serialized per canonical path. Replacements require the reviewed baseline hash, including at the final gateway mutation; no-hash writes are exclusive CREATE. Deleted baselines fail instead of recreating. Temporary sibling + atomic publication avoid partial writes under gateway-owned concurrency. Concurrent privileged host processes remain outside this boundary.

Web agent proposals now require persisted approval decisions bound to the current canonical effects hash, execution/step/source/content consistency and non-replayed effects. Plan edits cannot downgrade risk/approval/structure. Old approvals without persisted decision records fail closed and require fresh review. Positive real-model proposal acceptance remains unproven; synthetic negative/concurrency regressions are not AI certification.

## Full checkpoint @3e181c5

Cloud Quality 39777254105 SUCCESS and Hosted Web UI 39777254020 SUCCESS. Covers reviewed CREATE/no-overwrite, stale concurrent writes, rejection of approval downgrade/start without approval, prompt full flow, shortcut persistence/rejection, evidence export, light/dark responsive HUD and browser-back draft preservation. All hosted execution occurred in the GitHub Linux fixture. No local tests/build/install, paid inference, production deployment or physical certification.

Terminal follow-up implements up to four independent panels and explicit shell confirmation. Gateway caps four active PTYs per workspace and 32 total, expires at 15min without input or 60min lifetime. New hosted test observes two real PTYs, uses synthetic shell variables/files to prove isolation and verifies close cleanup; timer regression uses fake time in remote unit tests. This new delta requires its own CI; Desktop/ConPTY remains deferred.

## Documentation and subprocess boundary

Project Bible entrypoint, backlog and traceability now distinguish the historical physical RC1 inventory from the proven cloud checkpoint. Remaining implementation tasks are explicitly retained; this ledger does not declare all install-independent work completed. Notion/Miro tasks #13/#20 moved to Em Andamento; #19/#24/#27/#29 retain that state with @3e181c5 evidence. No historical completion was recertified.

Gateway subprocesses now receive the existing restricted environment allowlist rather than all gateway credentials. Hosted checks only token-name presence/absence in the child shell and never prints its value. This does not sandbox all host filesystem access: manual shell confirmation and trusted Runtime host remain required. New screenshots disable finite animations; drawer opacity stays integral during entry.

## Certified terminal checkpoint and visual follow-up

@fb74616: Cloud Quality 39778914433 SUCCESS; Hosted Web UI 39778914380 SUCCESS. Real Linux PTY sessions, variable isolation, actual files, close cleanup and gateway-token name absence proved. Screenshots stabilize finite animations and drawer remains opaque. No Windows/ConPTY or production claim.

New visual library registers existing regular files under /workspace/assets and records source, user-declared license/attribution/rights. Durable mutations serialize; shared core refuses unknown/restricted/blank licenses and paths outside assets. USER_PROVIDED avoids false provider provenance. HTTP(S) source metadata is not fetched. No copy, image transformation, license verification by an external authority or paid integration is performed. New positive/negative/persistence/concurrency hosted tests await CI.

## Visual result and durable Runtime receipts

@318df62 Hosted Web UI 39823528495 SUCCESS. Cloud Quality 39823528496 failed at lint because one Promise.all test branch returned a non-Promise; corrected explicitly. No full Cloud Green for that head. Visual registration/license/persistence and prior browser scenarios passed remotely.

New Runtime history persists up to 100 immutable server-constructed receipts per workspace in DO. Each includes server start/end, state, intended Runtime Gateway source, platform and executionConfirmed. Unavailable/transport outcomes never confirm execution. Persistence must be acknowledged before returning the gate outcome. Public history only reads; it accepts no client-created receipts. UI reload/export and concurrent storage/restart/cap regressions added. Session observations remain separately labeled. New delta awaits CI; no release/physical equivalence.

## Git query and React correction

New delta replaces gateway's fabricated empty Git status on failures with explicit unavailable errors. Desktop/gateway share the documented porcelain v2 NUL parser, preserving spaces/newlines, consuming rename origins and handling conflicts/upstream counters. Diff disables external helpers/textconv/color. Read-only UI shows actual staged/worktree entries and unstaged tracked diff; commit/checkpoint/restore remain separate unfinished work. Real temporary Git repo and hosted PTY initialization regressions added. Reference: https://git-scm.com/docs/git-status.

Cloud Quality 39824161515 stopped at React set-state-in-effect for the initial history reset. Replaced with project-keyed snapshots updated after asynchronous responses; no synchronous effect reset and no old-workspace display. New delta requires remote gates; no local tests.

## Parent-repository discovery finding

@84f876d Cloud Quality 39825438740 SUCCESS; Hosted 39825438717 FAILURE: nine scenarios pass, the new unavailable-repository assertion fails. Actual root cause: Git walked upward from the isolated workspace and discovered the CI checkout's parent repository. This is a scope defect, not a flaky assertion. Set GIT_CEILING_DIRECTORIES for gateway child processes/PTYs and the desktop Git adapter; add a real parent/child repository regression. Do not treat the earlier status as a clean isolated repository. New head requires both gates; no local test or production action.

## Verified checkpoint — 92d05f49f610fa983ad68facdee59af46a918899

[Cloud Quality 39826094603](https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio/actions/runs/39826094603) SUCCESS: lint, typecheck, unit, integration, security, controlled dogfood, build and all Cloudflare dry-run environments.
[Hosted Web UI 39826094506](https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio/actions/runs/39826094506) SUCCESS: **10 passed** against real ephemeral Worker/DO/gateway/filesystem/PTYs. Includes visual references/license negatives, durable evidence reload/export, Git unavailable/real repository checks, sessions, approvals/CAS, prompt lifecycle, preferences, keyboard/responsive themes and unsaved history guard.

This checkpoint corrects the parent Git discovery defect and preceding lint failures; those failed runs remain in the record. Last integration production-smoke run 38885409266 @70c0c97 remains FAILURE, PR #88 separate, no releases published. PR #89 stays draft; no merge/deploy or production credentials changed.

No local dependency installation, tests, build or app startup. Original ZIP/video bytes absent and not hash-recertified. Windows/ConPTY/package, providers/inference, human OAuth, Runtime/Tunnel/Access and exact-deployment smoke remain unproven. Remaining implementation above is real pending work: this is not 100% of V1 or all install-independent tasks, and not RELEASE-GREEN.
