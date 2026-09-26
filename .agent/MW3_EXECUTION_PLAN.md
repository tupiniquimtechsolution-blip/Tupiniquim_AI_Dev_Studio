# Master Wave 3 — Execution Plan

Issue canônica: #38
Branch: `cloud/mw3-dev-studio-hardening-dogfood`
Base: MW2 CLOUD-GREEN (`51671b7810af82040cd801e5be8fd4cab4b1f37d`)

## Objetivo

Fechar o Dev Studio cloud-compatível com hardening e dogfood controlado antes de qualquer Agent Registry Runtime completo da MW4.

## Regra de evidência

O repositório menciona “cenários A–K do Prompt Mestre”, mas o texto detalhado desses cenários não está presente como fonte canônica versionada. Portanto a MW3 não inventa conteúdo histórico: materializa uma **matriz operacional A–K da MW3**, derivada dos requisitos RF-01..15/RNF e das superfícies reais do código, explicitamente identificada como reconstrução de aceite. Se o Prompt Mestre detalhado for localizado depois e houver conflito, abre-se reconciliação em vez de reescrever a história silenciosamente.

## Estados de aceite

- `CLOUD_PASS`: prova automatizada no ambiente cloud compatível.
- `WINDOWS_DEFERRED`: exige Windows/Electron/ConPTY/Ollama/hardware/OAuth humano real.
- `NOT_APPLICABLE`: não pertence ao cenário/plataforma.
- `BLOCKED`: requisito aplicável sem evidência suficiente.

Nenhum `WINDOWS_DEFERRED` pode ser convertido em PASS por mock.

## Slices

### MW3.0 — Baseline e Engineering Playbook

- readiness contracts e matriz de aceitação;
- Vibe Coding Toolkit somente como `ENGINEERING_PLAYBOOK_SOURCE`;
- adotar conceitos compatíveis: brainstorm → plan, work waves sem colisão, review e quality gates;
- não importar automaticamente plugins, hooks, binários ou regra rígida de 350 linhas;
- GitHub/CI e arquitetura real prevalecem.

### MW3.1 — Dev Studio readiness

Provar as superfícies cloud-testáveis já implementadas:
- Workspace/path safety;
- Policy/approvals boundaries;
- Research + Knowledge + Registry;
- Technology Resolution;
- Prompt Architect;
- Visual license gate;
- Preferences/WCAG;
- Preview contracts/redaction;
- evidence/recovery semantics.

### MW3.2 — Hardening

- saída não confiável sanitizada antes de log/evento;
- segredo em prompt/log/preview não persiste em claro;
- path traversal e ingestão sensível bloqueados;
- rede externa continua sujeita a trust/policy;
- comandos absolutamente destrutivos continuam bloqueados inclusive em FULL_ACCESS;
- nenhuma descoberta de skill/API/MCP concede execução.

### MW3.3 — Dogfood A–K operacional

Matriz reconstruída de aceite MW3:

| ID | Cenário operacional | Prova cloud |
|---|---|---|
| A | Workspace/path boundary | path-security real/fixture |
| B | Policy/approval safety | PolicyEngine real |
| C | Research → Knowledge citation-first | ResearchAgent + KnowledgeRegistry |
| D | Technology resolution → registry sem auto-adoção | TechnologyResolutionEngine + RegistryCatalog |
| E | Prompt Architect versão/compile/lint de segredo | PromptArchitect real/in-memory repository |
| F | Visual asset exige licença conhecida | VisualIntelligenceService real/in-memory repository |
| G | Preferências preservam WCAG AA | PreferenceService real/in-memory repository |
| H | Skill/Public API/MCP discovery não concede runtime | Registry/Skill Gate |
| I | Preview/event output é redacted e limitado | sanitizer real; processo Electron/viewport fica deferred |
| J | Cross-project isolation A→B→A | Knowledge + Registry project scope |
| K | Release/readiness report não converte Windows deferred em PASS | readiness gate |

Plataformas WEB/DESKTOP/MOBILE entram como dimensões de recomendação/knowledge; efeitos de SO/hardware permanecem deferred.

### MW3.4 — Quality orchestration

Cloud Quality Gate passa a executar `pnpm test:dogfood` entre security e build.

Engineering playbooks são metadados/referências. Eles não podem:
- modificar política por conta própria;
- instalar dependências automaticamente;
- criar permissões;
- substituir review/gates canônicos.

### MW3.5 — Fechamento

- CI GREEN no HEAD final;
- diff/security review;
- `.agent/MW3_TEST_RESULTS.md`;
- `.agent/MW3_HANDOFF.md`;
- `STATUS.md` e `MASTER_PLAN.md` atualizados;
- Issue #38 fechada somente após HEAD documental final GREEN;
- PR permanece DRAFT/não mergeado.

## Definition of Done

1. `pnpm test:dogfood` executa cenários reais, não pasta vazia.
2. Readiness report impede promoção se houver `BLOCKED` e preserva `WINDOWS_DEFERRED`.
3. Segurança negativa cobre secrets/path/policy/trust.
4. Dev Studio cloud-testável possui evidência sem prometer certificação desktop.
5. Cloud Quality Gate executa lint, typecheck, unit, integration, security, dogfood, build e Cloudflare dry-runs.
6. Nenhum secret, token ou `.env.local` é ingerido/versionado.
7. MW4 só é liberada após MW3 `CLOUD-GREEN`.