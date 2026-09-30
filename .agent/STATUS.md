# Status

Atualizado em: 2026-09-30

## Estabilização Release Green (branch de trabalho sobre `integration/ai-lab-toolbox-unified` @ 4f32f35)

**RELEASE_CANDIDATE_READY — PR #80 aberto (hotfix Web + estabilização).**

- Inventário canônico: `docs/RELEASE/RELEASE_GREEN_AUDIT.md` (RG-01…RG-16);
  matriz de gates: `docs/RELEASE/RELEASE_GREEN_CHECKLIST.md`.
- Corrigido nesta onda: parser Workers AI OpenAI-compatible (JSON bruto no
  chat, RG-01/02), mensagens por estado do Remote Runtime em gates/drawers/
  Control Center (RG-03/04), e o falso "vermelho eterno" de integration/
  security — eram invocação local sem TEMP, não falha de produto (RG-06:
  integration 104/104, security 55/55 com TEMP=/tmp; CI ubuntu sempre passou).
- Gates locais 100% PASS (lint/typecheck/unit 368/dogfood 13/build/dry-runs
  web+control-plane+MW0–MW5). CI: cloud-quality PASS em dcde40d; smoke real
  de browser PASS na base 4f32f35.
- Bloqueios EXTERNOS documentados com passo mínimo e teste de validação:
  RG-05 runtime DISABLED em produção (vars/secret/tunnel — RUNBOOK §2),
  RG-07 Workers Builds do dashboard falhando em branch de PR,
  RG-08 Access ANONYMOUS_TEST. Ambiente: RG-09 certificação Windows F:.
- Produção (health real 2026-09-30): ai=workers-ai OK, persistência READY,
  runtime DISABLED, auth productionReady=false.

## Tema Claro/Escuro/Sistema + transições (branch de trabalho sobre `integration/ai-lab-toolbox-unified`)

**IMPLEMENTADO — AGUARDANDO PR/CI.**

- `ThemePreference = LIGHT | DARK | SYSTEM` com persistência por superfície,
  resolução via `prefers-color-scheme` (reativa a mudanças do SO) e aplicação
  como `data-theme` no `<html>` antes do primeiro render (sem flash, sem
  script inline — CSP preservada). Ver `renderer/src/theme.ts` e
  `DESIGN_SYSTEM.md` (seções "Tema" e "Princípios de movimento").
- Tokens: `styles.css` 100% tokenizado (45+ hexes → variáveis) com bloco
  claro em `:root[data-theme='light']`; `web-experience.css` com `--wx-*`
  claro/escuro. Seletor Sistema/Claro/Escuro na landing, onboarding, Studio
  e nas Preferências do Desktop (Acento/Fundo mantidos como avançado).
- Monaco `vs`/`vs-dark` conforme tema resolvido; terminal permanece escuro.
- Transições de rota Web (180–200ms, opacity/translateY) sem quebrar
  pushState/popstate/recovery; microtransições 120–200ms; tudo desativado
  sob `prefers-reduced-motion: reduce`.
- Testes: `tests/unit/web-theme.test.ts` (10 casos) + smoke de tema em
  `tests/web-smoke/web-full.spec.ts`. Gate: lint/typecheck/unit/dogfood/build
  PASS; integration (22) e security (1) com falhas pré-existentes de ambiente
  (exigem unidade F:/TEMP Windows), idênticas ao baseline.

## Web Product Experience (branch `feat/web-clean-product-experience`)

**IMPLEMENTADO — AGUARDANDO PR/CI.**

- Nova experiência Web em três momentos: landing pública (`/`), onboarding
  conversacional (`/onboarding`) e Studio chat-first (`/studio`), com o
  workbench clássico preservado em `/workbench`. Desktop intocado.
- Regras fail-closed da Issue #25 extraídas para fonte única
  (`apps/desktop/src/renderer/src/agentGating.ts`) compartilhada Web/Desktop.
- Monaco/xterm agora carregam sob demanda (landing leve); bundling local sem
  CDN preservado e testado.
- Remote Runtime: estados DISABLED/MISCONFIGURED/OFFLINE/READY refletidos no
  chip "Execution"; ferramentas de SO bloqueadas com mensagem discreta quando
  não-READY; chat Cloud nunca bloqueado. Nenhum contrato de API alterado.
- Documentação: `docs/WEB/PRODUCT_EXPERIENCE.md` + ADR 0018.
- Validação local (sandbox Linux): lint GREEN, typecheck GREEN, unit GREEN
  (329), dogfood GREEN, build GREEN. `tests/integration/persistence.test.ts`
  e `tests/security/secret-environment.test.ts` falham nesta sandbox por
  exigirem volume `F:` do Windows e ambiente de segredos privado — falhas
  idênticas no commit base (não são regressões); devem ficar GREEN no CI
  oficial. `test:web-smoke` requer deployment real (atualizado
  semanticamente para o novo fluxo de entrada).

## Estado operacional atual

- Estratégia: **CLOUD-FIRST / ZERO-COST-FIRST**, com GitHub como fonte de verdade.
- Branch canônica: `integration/ai-lab-toolbox-unified`.
- Candidato Web cloud-only certificado: `aee4814bf6e8fecdf1bbcc74cff16e7b62c374bb`.
- URL pública: `https://tupiniquim-dev-ai-web.tupiniquim-techsolution.workers.dev`.
- Cloudflare Containers pagos foram removidos da arquitetura Web.
- Cloudflare Free hospeda UI/Worker/Workers AI/Durable state.
- Execução de SO é fornecida pelo **Tupiniquim Remote Runtime** opcional no hardware do usuário.
- Modelo Web padrão gratuito: `@cf/zai-org/glm-4.7-flash`.

## Estado por camada

### Código
**GREEN**

### CI
**GREEN**

Cloud Quality run `36546104298`: **SUCCESS**.

### Deploy Cloudflare
**GREEN**

Workers Build do candidato:
- Build ID: `b75fea78-0569-4237-9c5d-d2dc7ec1c32b`
- Version ID: `7dfdc1aa-90a0-4456-9c44-98a635e1e929`
- conclusão: **SUCCESS**

### Web Product Smoke
**GREEN — CLOUD-ONLY**

Run:
`36546098267`

Playwright:
- health/functional readiness: PASS;
- UI Web Full + workspace/model bootstrap + chat + session recovery: PASS;
- workspace/R2/Remote Runtime: SKIPPED porque o Remote Runtime ainda não está conectado.

Artifact:
- `web-product-smoke-aee4814bf6e8fecdf1bbcc74cff16e7b62c374bb`
- ID: `11022029029`
- SHA256: `71e70b5556fe2ecc6354c2bac401b9c299b5ba4b7b0ccd1ead417d5390af9a64`

Issue #53 foi encerrada como concluída.

### Remote Runtime
**IMPLEMENTADO / NÃO CONFIGURADO**

Issue canônica da próxima fase:
#68 — conectar e certificar Tupiniquim Remote Runtime via Cloudflare Tunnel.

Capacidades a certificar quando conectado:
- workspace;
- filesystem;
- Git;
- terminal;
- build;
- testes;
- recovery;
- fail-closed quando runtime estiver offline.

## Classificação atual

- CODE: GREEN
- CI: GREEN
- CLOUDFLARE FREE DEPLOY: GREEN
- LIVE WEB CLOUD-ONLY SMOKE: GREEN
- CONTAINERS PAID: REMOVIDO
- REMOTE RUNTIME: IMPLEMENTED / NOT CONFIGURED
- NOVA MENSALIDADE OBRIGATÓRIA: ZERO dentro das franquias Free
