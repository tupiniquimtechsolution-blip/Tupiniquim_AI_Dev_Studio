# Dev Studio — execution audit, 2026-10-16

## Decision

**NOT RELEASE-GREEN.** This is a partial execution and evidence reconciliation,
not completion of the 34 Agenor tasks. Local tests were explicitly excluded by
the owner. No production deployment, merge, release, credential change or Windows
certification was performed. The owner authorized the isolated C: working copy.

## Current remote evidence

Canonical development branch: `integration/ai-lab-toolbox-unified`, inspected at
`70c0c977e6f1920dd7b2ab6c587afc1f5785f3f5`. `main` remains a separate release
line; its older F:-only instructions are superseded for cloud development by the
integration AGENTS.md. Physical Windows certification still requires F:.

| Evidence | Exact SHA | Result |
| --- | --- | --- |
| [Cloud Quality 38885419671](https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio/actions/runs/38885419671) | `70c0c977e6f1920dd7b2ab6c587afc1f5785f3f5` | SUCCESS |
| [Web Smoke 38885409266](https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio/actions/runs/38885409266) | `70c0c977e6f1920dd7b2ab6c587afc1f5785f3f5` | FAILURE: 4 passed, 1 skipped, 1 failed |
| [PR 88 Cloud Quality 38885973816](https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio/actions/runs/38885973816) | `702bd7347c86b1a03105740671e4033e68f2208f` | SUCCESS; does not certify deployment/smoke |
| [Historical Web Smoke 38883721480](https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio/actions/runs/38883721480) | `e3bec44710ac34f41f135ea2b1b0466ae701806e` | SUCCESS at that revision only |

Inspected failing job `116922538267`: the model selector was visible but its value
was empty at the immediate assertion. HUD/theme/landing tests passed; workspace
RPC was skipped. [PR #88](https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio/pull/88)
already addresses the assertion race without accepting an empty model. Do not
duplicate its patch, merge it into production, or infer chat success from CI.
The existing responsive checks cover widths 390/768/1024/1440; generated captures
were not visually inspected in this session. This change needs new evidence.

## Branch / PR / issue inventory

17 open PRs observed: #13, #30, #31, #32, #33, #36, #39, #41, #43,
#46, #50, #65, #76, #81, #82, #83, #88. This is an inventory, not review approval.
Release path remains integration → #50 (draft) → release/post-master-waves-integration
→ #46 (draft) → main. Retain #32 as physical RC1 history. Do not bulk merge the
historical wave chain. #82 contains the 34-task ledger but is still open.

17 non-PR issues observed: #3, #5, #6, #7, #24, #25, #28, #34, #37,
#45, #47, #48, #51, #59, #68, #78, #84. #78 still needs its complete
acceptance evidence despite merged toolchain changes; #84 needs current UI smoke.

GitHub ruleset `22233468` is active on the default branch: prevent deletion and
non-fast-forward, require PR, resolved review threads, strict `quality` check;
no bypass actors and current user cannot bypass. No GitHub releases were returned.
New work targets integration via PR, not main or a production branch directly.

## HUD review and implementation

Direction: existing Carbono/Floresta functional workspace. Keep the conversation
primary, explicit runtime status and existing tools/modes. Avoid decorative
motion, new visual systems, fabricated activity and additional dependencies.

Code review covered Studio header, provider/model, theme, tools/modes disclosures,
conversation, composer, empty/loading/error states, file/terminal/Git/activity
drawers, footer, and the shared Control Center. Design references: local
`.agents/skills/tupiniquim-toolbox/SKILL.md`, `.agent/DESIGN_SYSTEM.md`, ADR 0018,
and [anti-ai-slop SKILL.md](https://github.com/Krirox/anti-ai-slop-skills/blob/main/SKILL.md)
(blob `721e00b32f0047a21cb48a93a9e76aac2e0d1df1`). External decision:
**REFERENCE ONLY**. Upstream root exposed README/SKILL only, no license file;
no third-party code, assets, scripts or dependencies copied or executed.

Implemented:
- Native modal tool drawer: background inert, focus containment, Escape,
  backdrop close, return focus to visible tools summary.
- Disclosures close when keyboard focus leaves; specialized mode selection
  moves focus to the composer.
- IME composition Enter does not send a message prematurely.
- Readable header labels, 16px composer input, wrapping provider status,
  preserved send button width, bounded scrollable tools popover.
- 44px touch targets for key Studio controls on coarse pointers.
- Remote smoke assertions for drawer focus, Escape and focus restoration.

Residual UI checks: real browser visual review in light/dark/system, coarse-pointer
layout, zoom/reflow, screen-reader announcements and packaged Electron. Shared
Control Center and Google Tasks dock retain existing modal/focus behavior and
need a separate cross-surface review; this is not an accessibility certification.

## Agenor reconciliation

Read the project page, Agenor protocol, current Tasks schema and all 34 project
rows on 2026-10-16 (query had no more pages). Current counts match the 08/10
ledger: **17 A Fazer / 8 Bloqueada / 5 Em Andamento / 4 Concluída**.
No individual task status was promoted.

| Tasks | Current disposition / remaining proof |
| --- | --- |
| 1, 2, 32 | Google OAuth setup, human consent, real operations/revocation; #28 open |
| 3, 4, 9, 10, 11, 14, 15 | Real post-auth Codex dogfood and DEV/Electron evidence; #24/#25 open; excluded local work |
| 5, 12, 13 | Toolbox provenance / physical hashes and PR #31 acceptance; historical #12 completion is not current certification |
| 6, 7, 8 | Historical reconnect evidence preserved; not recertified at current SHA |
| 16 | Notion forbids MW2 before physical MW1; integration MASTER_PLAN permits cloud progression. Resolve scope explicitly, not by silently rewriting history |
| 17 | Miro kanban materialization remains unverified; a status comment is insufficient |
| 18, 33 | Umbrella / closeout remain incomplete; cloud builds do not close V1 |
| 19–30 | Files, terminal, Git, providers, execution/assets, evidence UI, profiles, research, prompt, visual, shortcuts, preview retain feature-specific acceptance work; not certified by this HUD patch |
| 31 | Physical package/E2E/ConPTY and same-SHA logs required; not run here |
| 34 | Composer runtime remains DEFERRED; no new runtime scope introduced |

Task #7 notes still describe PR #29 as draft/open; task #10 and project checkpoint
correctly record closed without merge. Treat the former as historical. Existing
ancestry evidence in PR #82 must not substitute for new post-auth dogfood.

## Release blockers and next executable gates

1. Review PR #88; after authorized exact-SHA deployment, run real Web Smoke.
   Current integration remains smoke-failing, regardless of prior green docs.
2. Review this PR and require its Cloud Quality result at its exact head.
   New UI smoke/visual evidence requires an authorized deployment; no deploy here.
3. RG-05 / #68: real gateway, tunnel, identity and READY capability smoke.
4. RG-08 / #59: production Access and production-ready smoke. No credential or
   production configuration was changed or independently certified here.
5. RG-09 / #51 / task 31: physical Windows package/ConPTY/recovery/providers
   on the final accepted SHA. Explicitly deferred under the no-local-tests request.
6. Reconcile docs and Agenor with actual feature acceptance; keep release PRs draft.

Local execution: **NOT RUN** lint, typecheck, unit/integration/security/dogfood,
build, browser tests, Electron, packaging or application startup. Static source
and diff review only. Remote CI results must be recorded separately. No release
checkpoint/tag created because its acceptance gates are incomplete.
