# Source re-audit — 2026-10-22

Decision: REFERENCE for the existing knowledge packs. No external code, skill,
installer, dependency, MCP or service adopted or executed in this audit.

GitHub contents and LICENSE were read at each exact recorded commit. All three
commits resolved and all three license files identify MIT. This confirms the
recorded source/license facts; it does not certify the source code as safe.

| Source | Recorded commit | LICENSE Git blob |
| --- | --- | --- |
| [free-claude-code](https://github.com/Alishahryar1/free-claude-code/tree/8ac3c6cd7172696bb9c35dff5f3c14384fc7b5f5) | `8ac3c6cd7172696bb9c35dff5f3c14384fc7b5f5` | `e1749833921e7e82b674fd5ef752545c53c97547` |
| [OpenManus](https://github.com/FoundationAgents/OpenManus/tree/3309bf4e416fb1c74b008f3e86494439a31bad53) | `3309bf4e416fb1c74b008f3e86494439a31bad53` | `db2216e1a5bfd392213f57a257930e9b2dcca684` |
| [humanizer](https://github.com/blader/humanizer/tree/9862685f575c65a8247f90369951df1b3416e3d6) | `9862685f575c65a8247f90369951df1b3416e3d6` | `625297fb778f32eb39d3a5b97e3e3b611b7304d6` |

Git blob identifiers above are not SHA-256 hashes of uploaded ZIP archives.
Original ZIP/video bytes are absent from this workspace's read-only sources.
Their historical hashes cannot be revalidated here and remain unverified.
No new archive was downloaded as a substitute for the original uploaded bytes.

SHA-256 of the current tracked knowledge-pack files, computed read-only:

| File | SHA-256 |
| --- | --- |
| `KNOWLEDGE_PACK_2026-09-18.json` | `75f9ded5706134d7d9c5d769aec3fed5b4275badebe38bd3ca315a14dc80c8d0` |
| `KNOWLEDGE_PACK_MEDIA_2026-09-18.json` | `28595fbce391c7ee328084012522b5848e1a506db84a2f8ce383aa4c03c2678e` |

Dependency/script indicators exist at the pinned source roots: Python manifests,
lockfiles and scripts in free-claude-code; requirements/setup/Dockerfile/MCP
entry points in OpenManus; scripts/plugin metadata in humanizer. These are
adoption review inputs, not authorization to run them. No full dependency or
permissions audit performed. No inference cost, network egress or credential
authority is granted. Automatic provider fallback remains rejected.

The media case study marked `sync_allowed: false` remains excluded. No exposed
credential was read, reproduced or tested. Canonical repository provenance for
WorldClaw remains unverified; a paper reference is not repository verification.

No bulk merge of historical Toolbox/RC1 branches. Physical portability and
archive-hash acceptance require original artifacts and the corresponding host;
they are not implied by cloud reference verification.
