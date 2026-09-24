# Status

Atualizado em: 2026-09-24

## Estado atual

- Estratégia operacional: **CLOUD-FIRST**.
- GitHub: fonte de verdade e ambiente canônico de desenvolvimento/CI/checkpoints.
- PR #32 / branch `arena/01a0c8ba-tupiniquim-ai-dev-studio`: preservado como trilha RC1 Windows, **DRAFT / NÃO MERGEADO / WINDOWS-DEFERRED**.
- PR #33 / branch `cloud/master-wave-2-foundation`: fundação cloud-first **CLOUD-GREEN / DRAFT / NÃO MERGEADO**.
- PR #36 / branch `cloud/mw2-research-knowledge-registries`: Master Wave 2 **CLOUD-GREEN / DRAFT / NÃO MERGEADO**.
- `package:win` chegou a PASS no Windows físico após instalação das bibliotecas Spectre; RC1 completa não foi declarada RELEASE-GREEN.
- Cloudflare: preview + ambientes MW0–MW5 validados por dry-run no gate cloud; deploy real segue condicionado a credenciais válidas.
- Supabase: projeto dedicado `Tupiniquim-AI-Dev-Studio`, ref `brqokxlmxwyxwwbtsltc`, `ACTIVE_HEALTHY`; nenhum DDL remoto aplicado pela MW2.
- Google Drive: workspace MW0–MW5 preparado; uploads ainda podem chegar ao `01_INBOX_UPLOADS` e serão classificados após conclusão do envio.

## Estados formais

- `CLOUD-GREEN`: gates cloud compatíveis passam no GitHub Actions.
- `WINDOWS-DEFERRED`: certificação Windows real permanece pendente.
- `RELEASE-GREEN`: cloud + certificações obrigatórias de release comprovadas.

## Master Waves

- Master Wave 0: CONCLUÍDA.
- Master Wave 1: desenvolvimento cloud consolidado; RC1 Windows preservada como `WINDOWS-DEFERRED`.
- Master Wave 2: **CLOUD-GREEN / CONCLUÍDA NA TRILHA CLOUD**.
- Master Wave 3: **AUTORIZADA COMO PRÓXIMA TRILHA CLOUD**, sem implicar RELEASE-GREEN Windows.
- Master Waves 4–5: seguem a ordem do `.agent/MASTER_PLAN.md`.

## Master Wave 2 — entregas

- Registry contracts provider-neutral com scopes `GLOBAL` / `PROJECT`.
- Lifecycle explícito: `DISCOVERED`, `VERIFIED`, `APPROVED`, `REJECTED`, `DEPRECATED`.
- Registry/Skill Gate com licença, custo, dependências, permissões, provenance, citations e aprovação; runtime permanece não autorizado por construction.
- Research Agent citation-first; conteúdo externo continua `EXTERNAL_UNTRUSTED` e `instructionsAuthoritative=false`.
- Knowledge/RAG Registry isolado por `projectId`, com chunks, hashes, citations e policy de auto-ingestion.
- Technology Resolution integrado ao registry como descoberta por projeto, sem adoção automática.
- Tool/MCP/Public API/Platform usando contrato/gate comum; Public APIs não vira allowlist.
- Skill Registry + snapshot validation; `find-skills` pinned continua apenas descoberta.
- referências curadas MW2 registradas como metadata/capability sources, sem ativação automática.

## Evidência MW2

HEAD funcional auditado: `f34a883a235ae447355500112a6a37b92ea52ed5`.

Cloud Quality Gate run `36017449406`: PASS
- lint
- typecheck
- unit
- integration
- security
- build
- Cloudflare preview dry-run
- Cloudflare MW0–MW5 dry-runs
- evidence step

Skills Snapshot Validation run `36017449373`: PASS.

Documentos:
- `.agent/MW2_EXECUTION_PLAN.md`
- `.agent/MW2_TEST_RESULTS.md`
- `.agent/MW2_HANDOFF.md`

## Google Drive

Raiz: `Tupiniquim AI Dev Studio/`.

Áreas globais:
- `00_CANONICAL`
- `01_INBOX_UPLOADS`
- `02_MASTER_WAVES`
- `03_EVIDENCE`
- `04_BUILDS_RELEASES`
- `05_DATA_IMPORTS`
- `06_HANDOFFS`
- `07_ARCHIVE`

MW2:
`02_MASTER_WAVES/MW2_Research_Knowledge_Registries/`
- `00_INPUTS`
- `01_RESEARCH`
- `02_EVIDENCE`
- `03_ARTIFACTS`
- `04_HANDOFF`

## Supabase dedicado

- projeto: `Tupiniquim-AI-Dev-Studio`
- ref: `brqokxlmxwyxwwbtsltc`
- URL: `https://brqokxlmxwyxwwbtsltc.supabase.co`
- região: `sa-east-1`
- estado inicial validado: `ACTIVE_HEALTHY`
- nenhum secret real versionado
- nenhuma migration/DDL MW2 aplicada remotamente

## Próximo passo

1. Rodar o gate final do HEAD documental MW2.
2. Classificar os arquivos restantes do `01_INBOX_UPLOADS` quando o upload estiver completo; isso é ingestão de conteúdo e não reabre o contrato MW2 salvo evidência de conflito.
3. Após o checkpoint final, iniciar Master Wave 3 na trilha cloud.
4. Manter Windows como certificação independente de release.
