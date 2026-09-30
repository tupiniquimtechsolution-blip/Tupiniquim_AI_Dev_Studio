# U6 Certification Matrix

## Cloud
- lint
- typecheck
- unit
- integration
- security
- dogfood
- build
- Cloudflare dry-runs

## Hosted Windows
- provision hosted F: contract
- lint/typecheck/unit/integration/security/build
- Windows script fixtures
- Electron E2E
- Package Windows
- artifact upload
- Control Center/portable runtime behavior must compile and render through the packaged application

## Physical removable-media gate
These items remain local-only and cannot be promoted by hosted CI:
- real USB/SSD removable media behavior;
- existing user model preservation on that device;
- user's actual Ollama/model/hardware/VRAM performance;
- thermal/memory behavior;
- real external runtimes installed on the user's AI Lab media.

Hosted success must be labeled HOSTED-GREEN, not physical-media PASS.
