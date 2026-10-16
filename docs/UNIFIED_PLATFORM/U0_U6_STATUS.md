# Unified Platform U0–U6 — Status

- U0 Contracts & Control Center: CLOUD-GREEN
- U1 Provider/Model Control: CLOUD-GREEN
- U2 Skill Control: CLOUD-GREEN
- U3 Toolbox Gates: CLOUD-GREEN
- U4 Portable AI Lab Runtime: CLOUD-GREEN
- U5 Agent Loadouts: CLOUD-GREEN
- U6 Certification: CLOUD portion GREEN; hosted Windows pending; physical USB/SSD remains separate.

## Safety invariants

- Provider/model selection is explicit.
- No automatic fallback.
- Skill discovery does not imply approval or execution.
- Privileged actions remain default-deny.
- Missing environment is NOT_AVAILABLE/SKIPPED, never PASS.
- Portable inspection is read-only.
- No silent runtime/model downloads.
- Existing models are never deleted by portable discovery.
- Agent loadouts require explicit approval and project-enabled skills.

## Integration state

PR #50 remains DRAFT and must not be merged until U6 hosted Windows certification is GREEN and the final security/release review is recorded.
