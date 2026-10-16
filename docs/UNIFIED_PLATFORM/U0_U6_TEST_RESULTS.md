# Unified Platform U0–U6 — Test Results

## Candidate

- Branch: `integration/ai-lab-toolbox-unified`
- Base release: `022ba49128a92c9f6616451ad447a07b0fa04e16`
- Candidate HEAD at this checkpoint: `429ae42d1193fe3d9d5dab90b3d802c5d9a5b9de`

## U0 — Contracts & Control Center

Implemented:
- unified manifest/parser;
- Control Center UI;
- fail-closed gate states;
- explicit provider/model policy;
- no automatic fallback;
- missing environment != PASS.

Evidence:
- `unified-control-center.unit.test.ts`: 5/5 PASS.

## U1 — Provider / Model Control

Implemented:
- explicit provider/model validation;
- Ollama requires explicitly selected installed model;
- Codex does not embed a local model;
- automatic provider/model recommendation/fallback is forbidden.

Evidence:
- `provider-model-control.unit.test.ts`: 6/6 PASS.
- existing provider reconnect/session/model provenance tests remain GREEN.

## U2 — Skill Control

Implemented:
- project-scoped enablement;
- explicit approval required;
- existing Skill Gate must report adoption-ready;
- runtime execution is not granted by enablement.

Evidence:
- `skill-project-control.unit.test.ts`: 4/4 PASS.
- existing registry/skill tests remain GREEN.

## U3 — Toolbox Gates

Implemented:
- allowlisted gate catalog;
- quality gates, dependency audit, security review, supply-chain;
- unsupported gates return NOT_AVAILABLE rather than false PASS;
- output redaction and bounded evidence;
- no arbitrary command input from renderer.

Evidence:
- `toolbox-gates.unit.test.ts`: 6/6 PASS.
- security suite remains GREEN.

## U4 — Portable AI Lab Runtime

Implemented:
- runtime/models/data/projects/cache portable layout;
- root containment;
- read-only runtime detection;
- no automatic downloads;
- no deletion of existing models;
- runtime catalog for Ollama, Open Generative AI, OpenHands, Qwen Code, Langflow and Open WebUI.

Evidence:
- `portable-runtime-registry.unit.test.ts`: 4/4 PASS.

## U5 — Agent Loadouts

Implemented:
- project + agent + provider + model + skills + permission profile;
- explicit approval required;
- Ollama requires explicit available model;
- Codex cannot carry local model;
- skills must already be enabled for the project.

Evidence:
- `agent-loadout-control.unit.test.ts`: 5/5 PASS.

## Cloud checkpoint

GitHub Actions Cloud Quality Gate run `36248083651`: SUCCESS.

- lint PASS
- typecheck PASS
- unit: 295/295 PASS
- integration: 104 PASS + 4 explicit environment/live skips
- security: 55/55 PASS
- dogfood: 13/13 PASS
- build PASS
- Cloudflare preview dry-run PASS
- Cloudflare MW0–MW5 dry-runs PASS

## U6 — Certification

Cloud portion: GREEN.
Hosted Windows certification: PENDING at this checkpoint.
Physical USB/SSD certification remains a separate local gate and must never be inferred from hosted CI.
