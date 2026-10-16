# ADR 0018 — Web Clean Product Experience (Landing + Onboarding + Studio chat-first)

Status: PROPOSTA IMPLEMENTADA
Data: 2026-09-30

## Contexto

A superfície Web certificada reutilizava o workbench Desktop (`App.tsx`) como tela
única: rail de atividades, explorer, editor Monaco, painel de agente e deck
inferior sempre visíveis. O resultado parecia um editor de vídeo/IDE permanente e
carregava Monaco/xterm já na entrada, mesmo para visitantes anônimos.

Requisitos da fase (Issue de experiência Web): landing pública de produto,
registro/onboarding conversacional e chat como superfície principal, com
progressive disclosure das ferramentas técnicas — sem migrar framework, sem criar
segunda aplicação, sem alterar contratos de API, sem remover capacidades e sem
tocar no comportamento fail-closed do Remote Runtime.

## Decisão

1. **Bifurcação por bridge, não por app**: `main.tsx` continua o único entrypoint.
   Com bridge nativa (Electron) monta o workbench clássico; sem bridge monta
   `web/WebExperience` (roteador SPA client-side sobre o fallback SPA já existente
   do worker).
2. **Três momentos**: `/` landing pública leve; `/onboarding` multi-step
   conversacional que produz preferências locais (nunca permissões);
   `/studio` chat-first; `/workbench` mantém a superfície clássica completa.
3. **Fonte única de guardas**: as regras Issue #25 (evaluateSend,
   providerTurnBlockReason, handleAgentEvent etc.) saíram de `App.tsx` para
   `agentGating.ts` e são consumidas por ambas as superfícies sem alteração
   semântica. `ProposalProvenance` virou componente compartilhado.
4. **Progressive disclosure**: Monaco e xterm passam a ser importados somente
   pelas superfícies que os usam (`web/CodeEditor`, `web/Workbench`, drawer de
   terminal). O teste de bundling local do Monaco foi atualizado de forma
   semanticamente equivalente (continua proibindo CDN; agora também garante os
   pontos de carga sob demanda).
5. **Identidade**: nenhuma autenticação nova. Cloudflare Access /
   `WEB_ALLOW_ANONYMOUS` permanecem a borda; o onboarding é visual + preferências
   em localStorage validadas fail-closed.
6. **Runtime**: estados DISABLED/MISCONFIGURED/OFFLINE/READY exibidos como chip
   "Execution" distinto de Provider/Model; ferramentas de SO bloqueadas com
   mensagem discreta quando não-READY; chat Cloud nunca é bloqueado.

## Consequências

- O Web Product Smoke muda somente na entrada (`/` → CTA "Abrir Studio") e nos
  seletores de contêiner (`.web-studio .brand`); chat, recovery, terminal-quando-
  READY e RPCs seguem idênticos. Atualização registrada no próprio spec.
- Desktop e E2E Electron permanecem intocados (mesmo `App.tsx`, mesmos textos
  sanitizados da Issue #25 — agora importados do módulo compartilhado).
- A landing passa a ser o primeiro contato do produto; dependências pesadas só
  são pagas dentro do Studio quando usadas.

## Referências de UX (apenas visual/estrutura; nenhuma migração técnica)

- Landing: https://21st.dev/@web3templates/templates/nextly
- Registro: https://21st.dev/@openairlabs/templates/multi-step-ai-chat-style-lead-gen-form
- Chat: https://21st.dev/@tailgrids/templates/tailgrids-ai-chat
