# Status

Atualizado em: 2026-09-24

## Estado atual

- Estratégia operacional: **CLOUD-FIRST**.
- GitHub: fonte de verdade e ambiente canônico de desenvolvimento/CI/checkpoints.
- PR #32 / branch `arena/01a0c8ba-tupiniquim-ai-dev-studio`: trilha RC1 Windows, **DRAFT / NÃO MERGEADO / WINDOWS-DEFERRED**.
- PR #33 / branch `cloud/master-wave-2-foundation`: fundação cloud-first **CLOUD-GREEN / DRAFT / NÃO MERGEADO**.
- PR #36 / branch `cloud/mw2-research-knowledge-registries`: Master Wave 2 **CLOUD-GREEN / DRAFT / NÃO MERGEADO**.
- PR #39 / branch `cloud/mw3-dev-studio-hardening-dogfood`: Master Wave 3 **CLOUD-GREEN funcional / DRAFT / NÃO MERGEADO**; Issue #38 só é fechada após o gate do HEAD documental final.
- `package:win` chegou a PASS no Windows físico após instalação das bibliotecas Spectre; RC1 completa não foi declarada RELEASE-GREEN.
- Cloudflare: preview + ambientes MW0–MW5 validados por dry-run; deploy real segue condicionado a credenciais válidas.
- Supabase: projeto dedicado `Tupiniquim-AI-Dev-Studio`, ref `brqokxlmxwyxwwbtsltc`, `ACTIVE_HEALTHY`; nenhum DDL remoto aplicado por MW2/MW3.
- Google Drive: workspace MW0–MW5 preparado; uploads ainda podem chegar e são acervo/inputs, nunca fonte de verdade.

## Estados formais

- `CLOUD-GREEN`: gates cloud compatíveis passam no GitHub Actions.
- `WINDOWS-DEFERRED`: certificação Windows real permanece pendente.
- `RELEASE-GREEN`: cloud + certificações obrigatórias de release comprovadas.

## Master Waves

- Master Wave 0: CONCLUÍDA.
- Master Wave 1: desenvolvimento cloud consolidado; RC1 Windows preservada como `WINDOWS-DEFERRED`.
- Master Wave 2: **CLOUD-GREEN / CONCLUÍDA NA TRILHA CLOUD**.
- Master Wave 3: **CLOUD-GREEN FUNCIONAL / CONCLUSÃO DOCUMENTAL EM CHECKPOINT FINAL**.
- Master Wave 4: **AUTORIZADA COMO PRÓXIMA TRILHA CLOUD após confirmação GREEN do HEAD documental MW3**.
- Master Wave 5: PENDENTE após gate da MW4.

## Master Wave 3 — entregas

- contratos/readiness distinguem `CLOUD_PASS`, `WINDOWS_DEFERRED`, `NOT_APPLICABLE` e `BLOCKED`;
- `CLOUD-GREEN` pode existir com deferências Windows, mas `RELEASE-GREEN` não;
- dogfood A–K real materializado em `tests/dogfood/mw3-a-k.test.ts`;
- A–K operacional foi reconstruído dos RF/RNF versionados porque o detalhamento histórico original não foi localizado; reconciliação futura deve ser explícita;
- hardening de redaction provider-neutral para preview/log output;
- security gates negativos para secrets, path traversal, FULL_ACCESS absolute blocks e Skill Gate;
- Vibe Coding Toolkit pinado como Engineering Playbook Source não autoritativa, sem auto-install e sem regra global rígida de 350 linhas;
- Cloud Quality Gate agora executa `pnpm test:dogfood` antes do build;
- readiness matrix RF/RNF separa prova cloud de certificação Windows.

## Evidência MW3 funcional

HEAD funcional: `2a9be68cf17c6ac65101b499fd940b76acbd6e73`.

Cloud Quality Gate run `36020705177`: **PASS**
- install
- lint
- typecheck
- unit — 31 arquivos / 250 testes
- integration — 13 arquivos / 102 testes; 4 skips explícitos de ambiente/live
- security — 6 arquivos / 42 testes
- controlled dogfood A–K — 11/11
- build
- Cloudflare preview dry-run
- Cloudflare MW0–MW5 dry-runs
- evidence step

O run não gerou artifact persistido porque os paths opcionais de artifact ficaram vazios; o próprio run/steps é a evidência operacional.

Documentos MW3:
- `.agent/MW3_EXECUTION_PLAN.md`
- `.agent/MW3_READINESS_MATRIX.md`
- `.agent/MW3_TEST_RESULTS.md`
- `.agent/MW3_HANDOFF.md`
- `docs/AI_TOOLBOX/MW3_ENGINEERING_PLAYBOOK.md`

## Segurança / Drive

A policy de Knowledge impede ingestão automática de:
- `.env` / `.env.*` — incluindo `.env.local` detectado no upload;
- secrets/credentials/tokens;
- `node_modules`;
- `.cache`;
- `out`;
- `release`;
- `playwright-report`;
- `test-results`;
- `.wrangler*`;
- `.git`.

Não abrir nem indexar arquivos sensíveis apenas porque foram enviados ao Drive.

## Supabase dedicado

- projeto: `Tupiniquim-AI-Dev-Studio`
- ref: `brqokxlmxwyxwwbtsltc`
- URL: `https://brqokxlmxwyxwwbtsltc.supabase.co`
- região: `sa-east-1`
- nenhum secret real versionado
- nenhuma migration/DDL MW2/MW3 aplicada remotamente

## Pendências não bloqueantes

- Issue #37 — sincronização autenticada dos Top 500 skills.sh quando Vercel OIDC estiver disponível; rankings não são fabricados.
- classificação final do `01_INBOX_UPLOADS` quando o upload terminar.
- certificação Windows física independente para promover futuramente a `RELEASE-GREEN`.

## Próximo passo

1. Confirmar Cloud Quality Gate do HEAD documental final da MW3.
2. Fechar Issue #38 como `completed` somente após esse GREEN.
3. Manter PR #39 DRAFT/não mergeado até integração explícita.
4. Liberar Master Wave 4 na trilha cloud, sem alterar o estado `WINDOWS-DEFERRED` da RC1.