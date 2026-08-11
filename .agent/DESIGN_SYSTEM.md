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

