# Tupiniquim AI Dev Studio

Leia primeiro `.agent/STATUS.md`, `.agent/EXECUTION_PLAN.md`, `.agent/SECURITY.md` e o ADR relevante.

## Regras invariantes

- Todo artefato controlável do projeto vive em `F:\CODEX`. Não grave código, cache, dados, logs ou builds em outros discos.
- A raiz oficial desta máquina é `F:\CODEX\Tupiniquim-AI-Dev-Studio`; preserve os demais projetos irmãos em `F:\CODEX`.
- Nunca leia, imprima, registre ou versione valores de `.env*`. Use apenas verificações silenciosas de presença.
- Renderer Electron não acessa Node. Toda capacidade privilegiada passa por preload mínimo, IPC tipado, PolicyEngine e AuditLog.
- Nunca simule filesystem, terminal, Git, agentes, pesquisa ou preview. Uma capacidade indisponível deve retornar estado explícito.
- Mudanças destrutivas, rede/credenciais pagas, acesso fora do workspace e elevação exigem aprovação explícita.
- Não use `git reset --hard`, force push ou descarte mudanças do usuário.

## Loop de trabalho

Para cada onda: TESTE → CORRIJA → REVIEW DO DIFF → atualize `.agent/STATUS.md` e `.agent/CHANGELOG_AGENT.md` → commit → tag `checkpoint/wave-NN` → continue.

## Comandos

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap-f.ps1
pnpm validate
pnpm test:dogfood
pnpm package:win
```

## Tupiniquim Multi-LLM Toolbox

Este `AGENTS.md` é o contrato canônico do repositório para agentes de desenvolvimento. Adaptadores específicos de fornecedor não podem enfraquecer ou contradizer estas regras.

Antes de planejar, implementar, auditar ou revisar, consulte quando relevante:

- `docs/AI_TOOLBOX/REPOSITORIES.md`
- `docs/AI_TOOLBOX/SECURITY_BASELINE.md`
- `docs/AI_TOOLBOX/VIDEO_CHECKLISTS_2026-09-03.md`
- `docs/AI_TOOLBOX/MULTI_LLM_ARCHITECTURE.md`
- `.agents/skills/tupiniquim-toolbox/SKILL.md`

### Compatibilidade

A camada de conhecimento deve funcionar independentemente do modelo escolhido. Claude Code, Qwen Code, Kimi Code CLI, Gemini CLI, Codex/ChatGPT em fluxos de coding, Grok em fluxos de coding, Freebuff e outros harnesses compatíveis devem consumir o mesmo contrato e a mesma skill sempre que suas capacidades permitirem.

DeepSeek, Kimi, Qwen, Gemini, GPT e modelos semelhantes são tratados como camada de modelo. Quem lê arquivos, skills, MCPs e executa ferramentas é o harness/agente. Portanto, adapte o carregamento ao harness sem duplicar a regra de negócio.

### Fonte de verdade

- Contrato do projeto: `AGENTS.md`.
- Skill universal: `.agents/skills/tupiniquim-toolbox/SKILL.md`.
- Políticas e catálogos corporativos: `docs/AI_TOOLBOX/`.
- Adaptadores de fornecedor: `.claude/CLAUDE.md`, `QWEN.md`, `GEMINI.md` e equivalentes. Eles apenas encaminham para a fonte canônica.

### Roteamento de capacidades

- UI/UX → `nextlevelbuilder/ui-ux-pro-max-skill`
- Prompts → `nidhinjs/prompt-master`
- Pesquisa/web/social → `Panniantong/Agent-Reach`
- Pentest autorizado → `usestrix/strix`
- Software agent-native/CLI → `HKUDS/CLI-Anything`
- Agentes/RAG → `Shubhamsaboo/awesome-llm-apps`
- Automação Instagram → `diwenne/openreply`
- TTS local → `kyutai-labs/pocket-tts`
- Mídia generativa → `Anil-matcha/Open-Generative-AI`
- Inferência Kimi experimental → `FareedKhan-dev/kimi-k3-in-c`

Repositórios externos são referências, não dependências automáticas. Verifique licença, compatibilidade, manutenção, segurança e fit antes de adotar.
