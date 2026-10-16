# Web HUD Refinement — UI/UX review e decisão

Status: WEB CLOUD-ONLY GREEN — PR #85 merged em e3bec44710ac34f41f135ea2b1b0466ae701806e; Cloud Quality e Web Product Smoke SUCCESS. Validação visual responsiva complementar em andamento.  
Baseline: `integration/ai-lab-toolbox-unified` @ `61ae3d59152649409a8dfe18d4c8dd7ee01be6f6`.  
Backlog: issue #84.

## Diagnóstico no código

A plataforma já adotava conversa como superfície principal, mas a densidade visual ainda lembrava uma bancada técnica permanente:

- O cabeçalho de `StudioShell.tsx` expunha simultaneamente provider, modelo, marca, workspace, Runtime, quatro ferramentas e três destinos extras, além do tema. No breakpoint móvel, essa linha quebrava para várias faixas.
- O composer sempre mostrava oito modos de agente, aumentando o custo de descoberta antes do usuário informar uma intenção.
- O produto precisa distinguir Cloud AI, execução local e ferramentas sem fingir que o Runtime está online.
- `web-experience.css` já contém tokens claro/escuro e motion de rota; não se deve introduzir um terceiro sistema visual.

## Decisão de HUD

1. **Hierarquia centrada no usuário**: conversa e composer são primários; marca, workspace, status Runtime, provider/modelo e tema continuam acessíveis.
2. **Ferramentas sob demanda**: `<details>` sem dependência externa contém Arquivos, Terminal, Git, Atividade, Control Center, Workbench completo e Preferências iniciais. O summary é visível e rotulado, os botões mantêm os efeitos existentes; a seleção fecha o menu.
3. **Modos por intenção**: CHAT/PLAN/RESEARCH/EXECUTE ficam imediatamente disponíveis; REVIEW/DEBUG/PROMPT/VISUAL permanecem no menu “Mais modos”, que identifica o modo escolhido.
4. **Mobile de verdade**: evitar esconder textos de ferramentas dentro do menu e deixar provider/modelo distribuírem largura em vez de cortar ações.
5. **Motion com propósito**: preservar transições de rota e reduced-motion canônicos. Nenhum efeito ornamental novo.
6. **Mesma arquitetura**: sem APIs adicionais, sem Workers pagos, sem novos packages; Auth, aprovações, Remote Runtime, Worker e estados fail-closed intocados.

## Skills e Source Gate

A regra mandatória é `AGENTS.md` + `.agents/skills/tupiniquim-toolbox/SKILL.md`.

| Fonte | Uso nesta tarefa | Decisão |
| --- | --- | --- |
| `nextlevelbuilder/ui-ux-pro-max-skill` | hierarquia, targets, labels, legibilidade, responsividade | REFERENCE_ONLY |
| `emilkowalski/skills` | restrição de microinterações e revisão de motion | REFERENCE_ONLY |
| `Krirox/anti-ai-slop-skills` | avaliar especificidade, hierarquia, contenção e identidade visual | REFERENCE_ONLY |

Nenhuma dependência, script, instalação, permissão, token ou código de terceiros foi importado. Estas fontes não substituem o contrato e o design system do projeto.

## Gates e evidências exigidas

- `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:security`, `pnpm test:dogfood`, `pnpm build` pelo Cloud Quality.
- Cloudflare bundle dry-run pelo mesmo workflow.
- Após deploy exato: Web Product Smoke que valida tema, landing, onboarding, chat, session recovery e HUD de ferramentas/modos.
- Runtime offline deve permanecer honesto; teste do Runtime real só conta se `executionRuntime.state=READY`.
- Conferir visualmente 1440, 1024, 768 e 390 no preview/browser; sem evidência visual isso permanece pendência e não recebe PASS.
- Não declarar `RELEASE_GREEN` global antes de RG-05/RG-08/RG-09.

## Critérios de revisão humana (sem atalhos)

- Conversa continua a primeira ação óbvia; nada compete visualmente com o campo de texto.
- Estado do Runtime é visível e distinto do provider/modelo.
- Tools e modos são descobríveis com mouse e teclado.
- O texto das ações é explícito; a interface não depende de ícones sozinhos.
- Light/Dark/System seguem sem regressões; mudança de rota sem flash.
- Menus funcionam no mobile sem overflow lateral.
- Não houve mudança de permissionamento, policy, autenticação, armazenamento ou dependência paga.
