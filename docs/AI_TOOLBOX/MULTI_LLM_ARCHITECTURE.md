# Arquitetura Multi-LLM da Tupiniquim

## Objetivo

Manter conhecimento, regras, checklists e skills da empresa no GitHub, sem prender os projetos a Claude, Qwen, Kimi, DeepSeek, Gemini, GPT, Grok, Freebuff ou qualquer outro fornecedor.

## Modelo

```text
Projeto
├── AGENTS.md                              # contrato canônico
├── .agents/skills/tupiniquim-toolbox/    # skill universal
│   └── SKILL.md
├── .claude/CLAUDE.md                     # adaptador Claude
├── QWEN.md                               # adaptador Qwen
├── GEMINI.md                             # adaptador Gemini
└── documentação específica do projeto
```

O repositório central `Tupiniquim_AI_Dev_Studio` mantém as políticas corporativas em `docs/AI_TOOLBOX/`.

## Princípio: modelo != agente

Uma LLM não precisa conhecer diretamente o filesystem ou o GitHub. Claude, Qwen, Kimi, DeepSeek, Gemini, GPT e Grok podem ser o modelo por trás de diferentes agentes/harnesses. O harness é responsável por ler `AGENTS.md`, skills, MCPs, terminal e conectores.

Assim:
- trocar de modelo não deve trocar a fonte de verdade;
- trocar de harness exige apenas um adaptador fino;
- regras corporativas não devem ser copiadas para prompts independentes e divergentes.

## Contrato universal

`AGENTS.md` é a primeira fonte persistente por projeto. Ele deve preservar regras específicas preexistentes. A Tupiniquim Toolbox é acrescentada sem apagar instruções de arquitetura, segurança, caminhos ou planejamento já existentes.

## Skill universal

`.agents/skills/tupiniquim-toolbox/SKILL.md` contém o comportamento reutilizável. Skills específicas externas continuam opcionais e são escolhidas conforme o problema.

## Adaptadores

### Claude
`.claude/CLAUDE.md` aponta para `AGENTS.md` e para a skill universal. A cópia em `.claude/skills/` pode existir por compatibilidade, mas não é a fonte canônica.

### Qwen
`QWEN.md` é fino: manda ler `AGENTS.md` e a skill universal. Nenhuma regra corporativa deve existir apenas no Qwen.

### Gemini
`GEMINI.md` faz o mesmo para Gemini CLI/harnesses compatíveis.

### Kimi / Codex / Grok / Freebuff
Quando o harness já respeita `AGENTS.md` ou `.agents/skills/`, não crie arquivo duplicado. Quando não respeitar, configure um adaptador local que aponte para os arquivos canônicos.

### DeepSeek
DeepSeek é tratado principalmente como modelo. Se estiver sendo usado por Qwen Code, Freebuff, OpenHands, Cline ou outro agente, esse harness carrega o contrato Tupiniquim.

## Roteamento de ferramentas

| Problema | Referência principal |
|---|---|
| UI/UX e design system | UI UX Pro Max |
| Prompt engineering | Prompt Master |
| Pesquisa e coleta web/social | Agent Reach |
| Pentest autorizado | Strix |
| Interface agent-native via CLI | CLI-Anything |
| Agentes, RAG e exemplos | Awesome LLM Apps |
| Automação Instagram | OpenReply |
| Voz/TTS local | Pocket TTS |
| Mídia generativa | Open Generative AI |
| Pesquisa de inferência Kimi | kimi-k3-in-c |

## Regras contra divergência

1. Nunca manter duas versões independentes de uma regra.
2. Adaptadores não devem conter lógica de negócio que não exista no contrato universal.
3. Se uma ferramenta exigir formato próprio, gerar esse formato a partir da fonte canônica.
4. Mudanças de segurança entram primeiro na baseline central e depois são propagadas.
5. Regras específicas de um projeto permanecem no próprio `AGENTS.md`, acima da camada corporativa.
