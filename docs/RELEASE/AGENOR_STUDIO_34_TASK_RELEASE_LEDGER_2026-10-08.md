# Agenor — Dev Studio · Ledger canônico de 34 tarefas

**Data do snapshot:** 2026-10-08  
**Projeto:** [Tupiniquim AI Dev Studio — Notion](https://app.notion.com/p/3de18931048881dba3defbfea3486ac4)  
**Repositório:** [Tupiniquim_AI_Dev_Studio](https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio)  
**Escopo:** exclusivamente o Tupiniquim AI Dev Studio. O pedido inicial mencionava “SaaS” por erro de digitação, corrigido pelo mantenedor. **Não utilizar a auditoria SaaS feita anteriormente como escopo deste projeto.**

## Regra de evidência

Este arquivo reconcilia as **34 tarefas explicitamente relacionadas** ao projeto do Notion; não significa que todas foram executadas nesta sessão. Os status abaixo são registros da base Notion verificados em 08/10 e podem estar defasados em relação ao código; somente mudar para Concluída após prova independente de CI/runtime/hardware. **Estado V1 / RELEASE_GREEN: ainda não certificado.** `BUILD PASS` não é `RELEASE_GREEN`.

**Contagem registrada:** 17 A Fazer · 8 Bloqueada · 5 Em Andamento · 4 Concluída.

## Backlog e Definition of Done por tarefa

| # | Tarefa | Estado no Notion | Evidência mínima para fechar |
|---:|---|---|---|
| 1 | Google Tasks OAuth Desktop | A Fazer | OAuth Desktop App + consentimento autorizados e configurados, sem token no renderer |
| 2 | Google Tasks E2E real | Bloqueada | Após #1: connect/list/create/complete/delete/disconnect + revogação e logs sanitizados |
| 3 | Codex fail-closed boundary | Em Andamento | Issue #25: provar READY e bloqueio antes de enviar; revisar fechamento sem merge do PR #29 |
| 4 | QA Wave17 / Master Wave 1 | Bloqueada | Depende #3/#9/#10/#11/#14/#15; QA real e handoff |
| 5 | Backlog futuro AI Toolbox | Em Andamento | Auditoria evidence-first; PR #31 draft; sem antecipar Waves/integrações pagas |
| 6 | Reconnect Codex no startup | Concluída | Commit be33b64 reportado, verificar na linha canônica antes de usar em RC |
| 7 | Auditoria fast-forward reconnect | Concluída | Evidência be33b64, sem force, escopo restrito |
| 8 | Windows F: E2E reconnect | Concluída | Gates reportados no SHA be33b64; não substituir dogfood pós-auth #9 |
| 9 | Codex dogfood pós-auth | Em Andamento | Codex já selecionado inicia READY, duas mensagens na mesma thread, sem loop/ghost turn |
| 10 | Issue #25 integrar Wave17 | Bloqueada | Depende #9; PR #29 foi fechado SEM MERGE — reconciliar caminho vigente antes de integrar |
| 11 | Renderer preto em DEV | A Fazer | Reproduzir com Electron/React.StrictMode, encontrar causa, corrigir ou demonstrar N/A |
| 12 | Knowledge Packs Toolbox em F: | Concluída | Hashes/arquivos reportados no ambiente Windows; verificar provenance quando acessível |
| 13 | Auditoria PR #31 Toolbox | A Fazer | Validar source/hashes/licença/JSON no Windows e aprovar integração isolada |
| 14 | Wave17 vs main / Google Tasks | Bloqueada | Após #10/#11: matriz de commits e conflitos, integração controlada sem rebase destrutivo |
| 15 | Issue #24 + checkpoint MW1 | Bloqueada | Após #10/#11/#14: QA, .agent, gate e tag evidenciados |
| 16 | Master Wave 2 preparação | Bloqueada | Somente após #15, sem início prematuro |
| 17 | Miro Kanban Agenor | Bloqueada | Materializar/sincronizar cartões com IDs, sem duplicar; comentário apenas não fecha tarefa |
| 18 | Sprint V1 / Master Wave 1 | Em Andamento | Umbrella: acompanhar #19–#33 e RC; não certificar por compilação isolada |
| 19 | Files UX V1 | A Fazer | Create/search renderer completos com path protections, atomic write e diff |
| 20 | Terminal V1 | A Fazer | Approvals, multissessão, cancel, timeout e prova ConPTY Windows real |
| 21 | Git V1 | A Fazer | Commit/checkpoint/restore sob PolicyEngine, approval e audit |
| 22 | Codex + Ollama homologação | A Fazer | Inferência real, auth isolada, seleção explícita de modelo, provenance e fail-closed |
| 23 | EXECUTE + VISUAL V1 | A Fazer | Orquestração real e asset operations sem placeholders/fallback inseguro |
| 24 | Test Runner + Evidence UI | A Fazer | Executar suites reais, mostrar provas, sem aba que finja execução |
| 25 | Perfis SAFE/ASSISTED/AUTONOMOUS/FULL_ACCESS | A Fazer | Seleção e persistência dos quatro perfis respeitando PolicyEngine |
| 26 | Research browser-second | A Fazer | HTTP-first → browser-second com provenance/confiança/network policy |
| 27 | Prompt Architect UI | A Fazer | Create/version/compare/validate/compile/export com testes |
| 28 | Visual Lab | A Fazer | Assets/transform/licença/provenance; fail-closed para direitos desconhecidos |
| 29 | Preferences shortcuts | A Fazer | Atalhos configuráveis e persistidos; integração com theme/layout |
| 30 | PreviewAdapter IPC/UI | A Fazer | Preview supervisionado, runtime empacotado, isolamento e responsividade |
| 31 | Windows package/E2E/ConPTY RC1 | Em Andamento | Ler logs de test:rc1-windows-scripts e package:win do evidence pack; corrigir e repetir full gate |
| 32 | Google Tasks OAuth smoke real | A Fazer | Validar NOT_CONFIGURED/AUTH_REQUIRED/READY e operação autorizada; depende #1/#2 |
| 33 | Closeout V1 / Master Wave 1 | Bloqueada | Depende #19–#32 + #15; auditoria/CI/Windows/Cloud/rollback/hand-off/tag |
| 34 | Toolbox Composer Agent pipeline | A Fazer | Especificação disponível; runtime DEFERRED, não bloquear V1 sem decisão específica |

## Divergências GitHub ↔ Notion em 08/10

1. [PR #80 — parser Workers AI / Remote Runtime](https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio/pull/80): **MERGED** (o relatório do Notion ainda citava antigos blockers Cloudflare/Toolchain; PR #79 também já foi merged).
2. [PR #50 — Unified Platform](https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio/pull/50): **OPEN / DRAFT**, head `integration/ai-lab-toolbox-unified@61ae3d59152649409a8dfe18d4c8dd7ee01be6f6` → `release/post-master-waves-integration`. Não está aprovado/merged por estar mergeable.
3. [PR #29 — Codex boundary](https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio/pull/29): **CLOSED, NOT MERGED**; as notas dos todos #3/#7/#10 ainda o referenciam como draft/open. Verificar se a correção foi absorvida por outro SHA antes de alterar status.
4. [PR #31 — Toolbox](https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio/pull/31): **OPEN / DRAFT**.
5. [PR #32 — RC1/Windows](https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio/pull/32): **OPEN / DRAFT**. HEAD remoto `9e9840a38a05d1989effe91134f6329abae507aa`; o Notion #31 menciona evidência local no `22dced6` (reconciliar ancestralidade; não afirmar same-SHA sem checagem).
6. [Issues #24](https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio/issues/24), [#25](https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio/issues/25), [#28](https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio/issues/28): permanecem **OPEN**.

## Ordem operacional por dependência

1. **G0 (baseline):** verificar branch e SHA atuais, PRs/CI; reconciliar #3/#10 com PR29 closed, #31 com PR32, testar integração do PR80 e as claims herdadas do PR79.
2. **G1 (Codex/Wave17):** #9 dogfood real pós-auth → #3/#10 Issue25 → #11 renderer/dev → #14 reconciliação Wave17→main → #15 Issue24. Nenhum merge sem gates e revisão.
3. **G2 (RC Windows):** #31 ler os dois logs reais do evidence pack, corrigir causa-raiz, retestar package:win, ConPTY e suites no mesmo commit.
4. **G3 (produto V1):** #19–#30 fechar capacidades de Files/Terminal/Git/providers/EXECUTE/VISUAL/Test/Evidence/Permissions/Research/Prompt/Visual/Preferences/Preview com provas UI+backend e testes negativos.
5. **G4 (OAuth):** #1 setup Google Desktop autorizado → #2 uso real → #32 homologação end-to-end. Não inventar OAuth Client ID, consentimento ou tokens.
6. **G5 (toolbox e release):** #5/#12/#13 catalogação/auditoria (sem instalar integrações inseguras), #17 Miro, #18 umbrella → #4/#33 closeout. #16 MW2 só após MW1. #34 DEFERRED por decisão anterior.
7. **G6 (Cloud production):** Remote Runtime READY e Access productionReady quando exigidos pelo release Web; Cloudflare Tunnel/host, dry-runs, secret hygiene, smoke real, backup/rollback e gates same-SHA. Sem reintrodução de Sandbox/Containers.

## Bloqueios fora do repositório e owner action

- **Windows F:/USB SSD:** os logs `test-rc1-windows-scripts.log` e `package-win.log`, ConPTY, MSVC/Spectre e hardware precisam ser inspecionados em host Windows real; sem eles não declarar Windows package green.
- **Codex pós-auth:** usar `CODEX_HOME` isolado e sessão autenticada autorizada para 2 turns na mesma thread, sem expor tokens.
- **OAuth Google Tasks:** requer configuração e consentimento reais no Google Cloud; não registrar client secrets no renderer.
- **Web/Cloud:** produção anteriormente exibiu `DISABLED` para Remote Runtime e `ANONYMOUS_TEST` para auth. Corrigir configuração e smoke onde escopo comercial/production assim exigir; não simular READY.
- **Miro:** comentário no board é atualização de status, não prova de kanban materializado. #17 permanece bloqueada até sync dos cartões.

## Critério de RELEASE_GREEN

Todos os gates obrigatórios para o escopo aceito devem estar `PASS` no **mesmo SHA**; os realmente não aplicáveis devem ter justificativa específica. CI, smoke Web e Desktop Windows, segurança, persistência, auth, providers, terminal/git/filesystem, Cloudflare deployments/rollback, documentação e registro do Agenor alinhados. Se um gate real faltar, reportar `BLOCKED_WITH_EXACT_REASONS`.

**Fonte operacional:** [Central Tupiniquim / Tarefas](https://app.notion.com/p/88884587a67f4bf6aec63ab5f5606b46), Sequência #1–#34 (IDs globais preservados).  
**Miro:** [Central Tupiniquim Visual](https://miro.com/app/board/uXjVHl4fqwQ=/), checkpoint no frame do Studio.
