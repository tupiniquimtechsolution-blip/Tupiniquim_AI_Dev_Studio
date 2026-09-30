# Design System

## Direção Carbono/Floresta

| Token | Valor |
|---|---|
| `--bg` | `#0B0F12` |
| `--surface` | `#11171C` |
| `--surface-raised` | `#182127` |
| `--text` | `#E7EEF3` |
| `--text-muted` | `#93A4AF` |
| `--accent` | `#27C483` |
| `--info` | `#49B6FF` |
| `--warning` | `#F2B84B` |
| `--danger` | `#FF6B6B` |

Fontes: Inter Variable para interface e JetBrains Mono Variable para código. Bundles locais devem incluir arquivos de licença OFL.

## Estrutura

- Ribbon superior: projeto, branch, modo, agente e estado.
- Rail esquerdo: navegação e workspace.
- Centro: editor, diff ou preview.
- Inspector direito: agente, plano, aprovação e contexto.
- Deck inferior: terminal, testes, review, logs e caixa-preta.

Painéis são redimensionáveis, recolhíveis e restauráveis. Ações perigosas usam linguagem e cor, nunca apenas cor. Foco visível, teclado completo, contraste AA e `prefers-reduced-motion` são obrigatórios.

## Assinatura original

A caixa-preta mostra a sequência causal de intenção → plano → aprovação → ferramentas → testes → diff → checkpoint. Gradientes sutis aparecem somente em empty states e Visual Lab.


## Tema Claro/Escuro/Sistema (ThemePreference)

- Preferência semântica `LIGHT | DARK | SYSTEM`, persistida por superfície:
  `tupiniquim.web.theme.v1` (Web, padrão SYSTEM) e
  `tupiniquim.desktop.theme.v1` (Desktop, padrão DARK — preserva o workbench
  escuro certificado). Implementação em `apps/desktop/src/renderer/src/theme.ts`
  (funções puras + controller injetável + hooks `useThemePreference`/
  `useResolvedTheme`).
- `SYSTEM` resolve via `matchMedia('(prefers-color-scheme: dark)')` e segue
  mudanças do SO em tempo real. O tema resolvido vira `data-theme="light|dark"`
  no `<html>` — aplicado ANTES do primeiro render (CSP proíbe script inline;
  o init vive no começo do bundle em `main.tsx`).
- Toda diferença visual vem de CSS variables: `styles.css` (escuro padrão em
  `:root`, claro em `:root[data-theme='light']`) e `web-experience.css`
  (`--wx-*` claro em `:root`/light, escuro em `[data-theme='dark']`). Nenhuma
  condição de tema em JSX. Sem preto/branco puros em grandes superfícies;
  identidade verde Tupiniquim nos dois temas.
- Monaco: `vs-dark` no escuro, `vs` no claro (via `useResolvedTheme`).
  Terminal (xterm) e superfícies de evidência técnica permanecem escuros;
  os contêineres ao redor integram-se ao tema.
- Customização avançada do Desktop (Acento/Fundo nas Preferências) continua
  existindo e sobrepõe o tema apenas quando difere da paleta de fábrica
  (ver `profileStyle` em `App.tsx`).

## Princípios de movimento

- Movimento é rápido, funcional e não-distrativo: transições de rota
  180–200ms (opacity + translateY ≤ 4px); microtransições 120–200ms apenas
  em `opacity/transform/background/border/color/box-shadow` — nunca
  `transition: all`, nunca slides/zoom/blur longos, nenhuma lib de animação.
- `prefers-reduced-motion: reduce` primeiro: toda animação vive dentro de
  `@media (prefers-reduced-motion: no-preference)`; o roteador Web
  (`WebExperience`) também pula a fase de exit e navega instantaneamente.
- Estado nunca é comunicado só por movimento nem só por cor
  (aria-pressed/labels acompanham).
