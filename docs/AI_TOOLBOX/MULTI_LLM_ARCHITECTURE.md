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

Claude, Qwen, Kimi, DeepSeek, Gemini, GPT e Grok podem ser modelos por trás de diferentes agentes/harnesses. O harness é responsável por ler arquivos, skills, MCPs, terminal e conectores.

Assim:
- trocar de modelo não deve trocar a fonte de verdade;
- trocar de harness exige apenas um adaptador fino;
- regras corporativas não devem ser copiadas para prompts independentes e divergentes.

## Contrato universal

`AGENTS.md` é a primeira fonte persistente por projeto. Regras específicas preexistentes continuam prioritárias. A Tupiniquim Toolbox é acrescentada sem apagar arquitetura, segurança, caminhos, planejamento ou gates já existentes.

## Skill universal

`.agents/skills/tupiniquim-toolbox/SKILL.md` contém o comportamento reutilizável. Skills externas continuam opcionais e são escolhidas conforme o problema.

## Compatibilidade verificada em 2026-09-04

### Claude Code

Claude usa `.claude/CLAUDE.md` como adaptador e mantém `.claude/skills/tupiniquim-toolbox/` apenas como shim de compatibilidade. A lógica real fica em `.agents/skills/`.

### Qwen Code

Qwen lê `AGENTS.md` do repositório, além de `QWEN.md`. Skills pessoais ficam em `~/.qwen/skills/` e skills de projeto em `.qwen/skills/`. Como o contrato já está em `AGENTS.md`, não é necessário duplicar regras. O script corporativo pode espelhar a skill universal para `~/.qwen/skills/tupiniquim-toolbox/`.

### Gemini CLI

`GEMINI.md` importa `AGENTS.md`. Gemini reconhece `.agents/skills/` no workspace e `~/.agents/skills/` no escopo do usuário como aliases interoperáveis de skills.

### Kimi Code CLI

Kimi descobre skills em `.agents/skills/` no projeto e, no usuário, em `~/.agents/skills/` ou `~/.config/agents/skills/`, além de diretórios próprios/compatíveis. Portanto a skill universal é consumível sem cópia específica por projeto.

### Grok Build

Grok lê a família `AGENTS.md` e também skills em `~/.agents/skills/`. Ele mantém compatibilidade adicional com recursos do Claude Code, mas a Tupiniquim usa `AGENTS.md` + `.agents/skills/` como caminho principal.

### Freebuff

Freebuff/Codebuff descobre `AGENTS.md` como arquivo de conhecimento e carrega skills globais de `~/.agents/skills/` e de projeto em `.agents/skills/`.

### Codex / ChatGPT coding

Codex usa `AGENTS.md` como instrução de projeto. Skills podem existir em superfícies OpenAI, mas disponibilidade/instalação varia por produto e plano; por isso o contrato obrigatório continua no repositório, em `AGENTS.md`.

### DeepSeek

DeepSeek é tratado como camada de modelo. Se executado por Qwen Code, Freebuff, OpenHands, Cline ou outro harness, esse harness deve carregar o contrato Tupiniquim.

## Instalação global da skill corporativa

Execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-ai-toolbox.ps1 -InstallMultiLLMToolbox
```

O script mantém a fonte canônica no repositório e espelha a skill para:
- `~/.agents/skills/tupiniquim-toolbox/` — Gemini, Kimi, Grok, Freebuff e outros compatíveis;
- `~/.qwen/skills/tupiniquim-toolbox/` — Qwen Code;
- `~/.claude/skills/tupiniquim-toolbox/` — Claude Code.

Isso não cria um `AGENTS.md` global, para evitar aplicar regras corporativas por acidente em projetos pessoais ou de terceiros. Nos projetos Tupiniquim, o `AGENTS.md` versionado é o contrato obrigatório.

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
6. Mirrors globais da skill são artefatos gerados e podem ser sobrescritos pelo script de sincronização.
