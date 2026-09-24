# Release & Integration Plan — Pós-Master-Waves

Data: 2026-09-24
Issue: #45
Branch: `release/post-master-waves-integration`
Base imutável: MW5 final `0ac65f1145e7b434c48684933ca97a5dd4a264e4`
Target: `main`

## 1. Objetivo

Consolidar a linha completa pós-Master-Waves em um único candidato de integração, preservar provenance dos PRs empilhados/laterais, reexecutar os gates cloud no exact head integrado e executar a certificação Windows no mesmo exact head antes de qualquer promoção a `RELEASE-GREEN` ou merge em `main`.

## 2. Fatos de baseline

- `main` atual no início desta fase: `eb93c352127d3b6263d1f2abf485ff31b390292a`.
- MW5 final: `0ac65f1145e7b434c48684933ca97a5dd4a264e4`.
- compare `main...MW5`: 171 commits ahead / 0 behind.
- Portanto, a linha Master Waves é descendente linear de `main`; não há rebase obrigatório contra commits novos de `main` neste checkpoint.
- Pilha principal: PR #32 → #33 → #36 → #39 → #41 → #43.
- `CLOUD-GREEN` prova os gates cloud compatíveis; não substitui Windows/hardware/OAuth humano.

## 3. Estratégia de integração

### 3.1 Branch de release

A branch `release/post-master-waves-integration` nasce exatamente do HEAD final MW5 e é a única branch mutável desta fase.

Os checkpoints MW2–MW5 permanecem imutáveis para auditoria.

### 3.2 PR único de consolidação

Abrir um PR DRAFT de `release/post-master-waves-integration` → `main`.

O PR de consolidação é o local para:
- diff final de integração;
- reconciliação seletiva de PRs laterais;
- CI exact-head;
- evidência Windows do exact head;
- review final de release.

### 3.3 PRs empilhados

Os PRs #32/#33/#36/#39/#41/#43 não devem ser mergeados em cascata durante esta fase. Sua história já está contida na branch de release e continua preservada como provenance.

Após a integração final em `main`, eles podem ser fechados como `superseded by release integration`, sem merge individual, desde que a ancestry/diff final continue comprovada.

## 4. PRs laterais

- PR #29: ancestor comprovado da linha atual; candidato a `superseded/absorbed` sem merge.
- PR #30: diverged; revisar arquivos/conhecimento únicos antes de qualquer incorporação.
- PR #31: diverged; revisar files/knowledge packs/security/media/3D e decidir por arquivo, não por merge de branch.
- PR #13: diverged; revisar google/skills e documentação first-party contra o Skill Registry/MW5 atuais antes de portar conteúdo.

Nenhum PR lateral será mergeado cegamente.

## 5. Gates

### Gate A — Integration topology
- `main...release` deve permanecer `ahead`, nunca `diverged`.
- `behind_by=0` antes da decisão de merge.
- nenhum force push.

### Gate B — Side-PR reconciliation
Para cada PR lateral:
1. identificar conteúdo único;
2. classificar `ABSORBED`, `PORT_SELECTED`, `OBSOLETE` ou `DEFERRED`;
3. portar somente arquivos/trechos aprovados para a branch de release;
4. revisar diff e provenance;
5. nunca importar secrets/binários/credenciais.

### Gate C — Cloud exact-head
Executar no exact head de release:
- install frozen lockfile;
- lint;
- typecheck;
- unit;
- integration;
- security;
- dogfood;
- build;
- Cloudflare preview dry-run;
- MW0–MW5 dry-runs;
- skills snapshot quando aplicável;
- review de diff/policy/secrets.

### Gate D — Windows exact-head
O checkout Windows físico deve apontar para o mesmo SHA da branch de release.

Exigir:
- `validate:f-drive`;
- `test:rc1-windows-scripts`;
- Electron E2E sem skips indevidos;
- ConPTY/Terminal real;
- `package:win`;
- provider local/Ollama gate aplicável;
- startup/shutdown/restart/recovery;
- isolamento A→B→A;
- proposal/EXPIRED;
- privacy/redaction/persistence;
- smoke do instalador/executável;
- OAuth humano somente quando o critério exigir fluxo real.

Resultados antigos de PR #32 servem como histórico, mas não certificam automaticamente o exact head pós-MW5.

### Gate E — Release audit
- nenhum secret versionado;
- nenhum bypass de PolicyEngine/ApprovalStore/PlanApprovalService/AuditLog;
- `runtimeExecutionAuthorized=false` preservado onde definido;
- provider/model continuam user-controlled;
- docs/status/release notes alinhados ao código;
- PRs laterais classificados;
- issue #45 com checklist atualizado.

### Gate F — RELEASE-GREEN
Somente quando C + D + E estiverem GREEN no mesmo exact head:
- atualizar estado para `RELEASE-GREEN`;
- marcar PR de consolidação ready for review;
- decidir merge em `main`;
- pós-merge, rerodar smoke/gates essenciais no novo `main`;
- somente depois criar checkpoint/tag/release notes definitivos.

## 6. Failure policy

Qualquer failure interrompe promoção.

É proibido:
- trocar failure por skip para obter GREEN;
- inflar timeout sem diagnóstico;
- omitir hardware/OAuth exigido;
- usar evidência de outro SHA como PASS do exact head;
- declarar `RELEASE-GREEN` apenas por Cloud CI.

## 7. Ordem operacional

1. inventário + matriz de PRs;
2. PR DRAFT de consolidação;
3. fechar somente PRs comprovadamente absorvidos;
4. reconciliar #13/#30/#31 seletivamente;
5. Cloud Quality Gate exact-head;
6. Windows certification exact-head;
7. auditoria final;
8. decisão de merge;
9. smoke pós-merge;
10. checkpoint/tag/release somente se comprovado.
