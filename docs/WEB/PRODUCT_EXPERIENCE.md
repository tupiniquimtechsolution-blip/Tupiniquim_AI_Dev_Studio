# Web Product Experience — Landing + Registro + Studio Chat-First

Atualizado em: 2026-09-30
Branch de trabalho: `feat/web-clean-product-experience` (sessão de execução: `arena/01a0f246-tupiniquim-ai-dev-studio`).

## Objetivo

Corrigir o problema visual da superfície Web (aparência de "editor de vídeo"/IDE
permanentemente aberta) sem remover nenhuma capacidade. A experiência agora tem
três momentos claros:

1. **Landing pública** (`/`) — explicação de produto, sem dependências pesadas de editor.
2. **Onboarding conversacional** (`/onboarding`) — multi-step, uma decisão por vez.
3. **Studio chat-first** (`/studio`) — a conversa é a superfície principal; ferramentas
   de engenharia aparecem por progressive disclosure. O workbench clássico completo
   permanece em `/workbench`.

O Desktop (Electron) não passa por esse fluxo: `main.tsx` detecta a bridge nativa e
continua montando o workbench (`App.tsx`) diretamente.

## Referências de UX/visual (não são novas arquiteturas técnicas)

| Momento | Referência |
|---|---|
| Landing | <https://21st.dev/@web3templates/templates/nextly> |
| Registro/Onboarding | <https://21st.dev/@openairlabs/templates/multi-step-ai-chat-style-lead-gen-form> |
| Chat principal | <https://21st.dev/@tailgrids/templates/tailgrids-ai-chat> |

As referências foram usadas apenas como direção estrutural/visual. Nenhuma marca,
texto ou identidade foi copiada; nenhum framework foi migrado (a stack continua
React + TypeScript + electron-vite + worker Cloudflare existente).

## Arquitetura da experiência

```
apps/desktop/src/renderer/src/
├── main.tsx                  # decide Desktop (App) x Web (WebExperience)
├── agentGating.ts            # regras fail-closed compartilhadas (Issue #25)
├── components/
│   └── ProposalProvenance.tsx# cartão de proveniência compartilhado
└── web/
    ├── WebExperience.tsx     # roteador SPA (landing/onboarding/studio/workbench)
    ├── experience.ts         # helpers puros: rotas, preferências, runtime view
    ├── Landing.tsx           # landing pública (leve, sem Monaco/xterm)
    ├── Onboarding.tsx        # multi-step conversacional (7 passos)
    ├── StudioShell.tsx       # Studio chat-first + drawers de ferramentas
    ├── CodeEditor.tsx        # Monaco lazy (só quando um arquivo é aberto)
    ├── Workbench.tsx         # superfície clássica completa em /workbench
    └── web-experience.css    # tokens claros derivados da identidade existente
```

### Roteamento

- `/` → landing no primeiro acesso; após o usuário entrar explicitamente no Studio,
  a raiz volta direto à conversa (flag local `tupiniquim.web.entered` — preserva a
  semântica de session recovery certificada no smoke).
- `/onboarding`, `/studio`, `/workbench` são sempre respeitados; caminhos
  desconhecidos caem no SPA fallback do worker (comportamento existente).

### Onboarding → preferências, não permissões

Passos: boas-vindas → uso pretendido → nível → stacks/interesses → Cloud vs
Cloud+Runtime Local → modelo inicial (somente entre os compatíveis reportados por
`agent.local-models`) → conclusão.

Saída: `tupiniquim.web.onboarding.v1` (JSON validado em
`web/experience.ts#parseOnboardingPreferences`, fail-closed para enums inventados)
e, quando escolhido, `tupiniquim.web.model` (mesma chave que a bridge Web já usa).

**Não há backend novo de cadastro.** A fronteira de identidade continua sendo a
existente (Cloudflare Access / `WEB_ALLOW_ANONYMOUS` no worker). O onboarding é
experiência visual + preferências locais; qualquer conta/perfil server-side fica
para uma fase futura com Access como borda — documentado como limitação.

### Studio chat-first

- Conversa central com estados: vazio ("Em que vamos trabalhar?" + sugestões
  contextuais por intenção), streaming (caret), erro, tool running, approval
  required (cartão de plano + proveniência), completed.
- Composer grande com modos (Chat/Plan/Research/Execute/Review/Debug/Prompt/Visual);
  Enter envia, Shift+Enter quebra linha; guardas fail-closed idênticas ao Desktop
  (fonte única `agentGating.ts`).
- Topbar: Model, Provider e Execution **separados e nomeados** (nunca misturados):
  `Model: GLM-4.7 Flash · Provider: Cloudflare Workers AI · Execution: Cloud` ou
  `Runtime Local — Online` quando o gateway reporta READY.
- Progressive disclosure: Arquivos (FileTree + Monaco lazy), Terminal (xterm lazy),
  Git (GitReviewPane), Atividade — todos em drawers; Control Center como modal
  existente; workbench completo a um clique.

### Remote Runtime (comportamento preservado integralmente)

Estados `DISABLED / MISCONFIGURED / OFFLINE / READY` lidos de `/api/health`
(`executionRuntime.state`). Quando não-READY:

- o chat Cloud continua 100% funcional;
- os drawers de SO mostram a mensagem discreta
  **"Conecte o Runtime Local para usar terminal, Git e filesystem."**
  com ações "Verificar novamente" e "Abrir Control Center";
- nenhum fallback silencioso.

Quando READY, Files/Git/Terminal/Build/Tests são liberados progressivamente
(mesmos contratos `window.studio.*` da bridge Web — nenhum contrato de API mudou).

## Linguagem visual

- Landing/onboarding/studio: superfícies claras, neutrals, contraste alto, bordas
  leves, radius consistente, sombras discretas, spacing generoso, motion curta com
  `prefers-reduced-motion` respeitado.
- O acento verde deriva da identidade Carbono/Floresta existente
  (`.agent/DESIGN_SYSTEM.md`), adaptado para contraste AA em fundo claro.
- Artefatos técnicos (plano vivo, proveniência de proposta, terminal, Control
  Center, editor) permanecem escuros de propósito: evidência técnica tem linguagem
  própria e reaproveita o CSS certificado existente sem retematização arriscada.

## Estados obrigatórios cobertos

loading (route fallback + boot do studio) · empty · streaming · error ·
offline/transporte (`WEB_TRANSPORT_ERROR` visível na conversa) · runtime offline ·
runtime ready · conversation active · tool running (drawers) · approval required ·
completed. Nenhum spinner sem mensagem/saída de erro.

## Testes

- `tests/unit/web-experience.test.ts` — rotas, preferências (fail-closed), estados
  do runtime, sugestões e regra compartilhada de envio.
- `tests/web-smoke/web-full.spec.ts` — atualizado semanticamente: novo teste da
  landing→onboarding e helper `enterStudio` (landing → CTA → Studio). Chat real,
  recovery, terminal-quando-READY e RPCs de workspace inalterados.
- `tests/unit/rc1-distribution.test.ts` — asserção do Monaco atualizada (o loader
  local continua obrigatório, agora carregado sob demanda; a landing não paga o
  custo do editor). Nenhuma asserção foi enfraquecida: o teste agora verifica o
  import dinâmico em `main.tsx` **e** os imports estáticos nas superfícies que
  hospedam o editor.

## Limitações conhecidas

1. Registro server-side (conta/perfil persistido) não existe — por decisão: a
   fronteira de identidade continua Cloudflare Access; o onboarding produz apenas
   preferências locais.
2. `pnpm test:web-smoke` exige deployment real (`WEB_SMOKE_BASE_URL`); deve rodar
   no fluxo Cloud Quality/Web Product Smoke do GitHub Actions.
3. Threads múltiplas nomeadas (sidebar de histórico) não fazem parte desta fase; a
   sessão única recuperável permanece como antes.
