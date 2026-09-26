---
name: tupiniquim-toolbox
description: Contrato universal de execução da Tupiniquim para planejamento, implementação, auditoria, segurança, UI/UX, pesquisa, prompts e adoção segura de ferramentas, independente da LLM usada.
---

# Tupiniquim Toolbox — Universal

Use esta skill em qualquer projeto da Tupiniquim quando estiver planejando, implementando, revisando, auditando, protegendo, pesquisando ou escolhendo ferramentas.

## Ordem de precedência

1. Regras específicas e existentes do projeto em `AGENTS.md`.
2. Planejamento/ADRs/documentação canônica do projeto.
3. Baseline corporativa e esta skill.
4. Adaptadores específicos de fornecedor.

## Método obrigatório

1. Inspecione o estado real do repositório antes de editar.
2. Identifique a categoria da tarefa e carregue somente referências pertinentes.
3. Preserve arquitetura, escopo e decisões existentes.
4. Não copie código externo cegamente; valide licença, dependências, manutenção, risco e compatibilidade.
5. Aplique a baseline de segurança.
6. Execute checks existentes e registre evidências.
7. Transforme achados reais em Issues pequenas, verificáveis e priorizadas.
8. Finalize com arquivos alterados, checks executados, riscos restantes, referências usadas e próximo passo.

## Roteamento

- UI/UX geral/design system → UI UX Pro Max.
- Motion, microinterações, animation review e design engineering → `emilkowalski/skills`.
- Landing page, portfólio, editorial ou redesign anti-template → `Leonxlnx/taste-skill:design-taste-frontend`; não usar como padrão para dashboard/data-heavy UI.
- Engenharia de prompts → Prompt Master.
- Pesquisa/web/social → Agent Reach.
- Pentest/remediação → Strix, somente alvos próprios ou autorizados.
- Software agent-native/CLI → CLI-Anything.
- Agentes/RAG → Awesome LLM Apps.
- Arquitetura/planning/MCP/sandbox de agentes → `FoundationAgents/OpenManus` como **reference source**, nunca autoridade operacional.
- Multi-provider/harness/runtime/catalog/code sessions → `Alishahryar1/free-claude-code` como **reference source**; não importar auto-fallback nem prioridade de provider/model.
- Engineering workflow/quality → Vibe Coding Toolkit como referência, não como runtime obrigatório.
- Produtos Google/Gemini/Google Cloud/Google Ads → `google/skills`; se a skill específica ainda não estiver carregada, usar `google/skills:skills/developers/finding-google-skills` como roteador oficial sob demanda.
- Instagram comment-to-DM → OpenReply.
- TTS local → Pocket TTS.
- Mídia generativa → Open Generative AI.
- Gemini video aliases → catálogo interno `GEMINI_VIDEO_PRESETS.md`.
- Referências de aprendizagem/descoberta → Free Programming Books, Public APIs, Docker Awesome Compose, TheAlgorithms e Coding Interview University.
- Supabase → capability/platform candidate por projeto, nunca dependência global.
- Inferência Kimi experimental → kimi-k3-in-c.

## Regra de carga

Não empilhe skills só porque existem. Selecione a menor combinação capaz de resolver a tarefa. Popularidade ou presença no Top 500 não equivale a aprovação de segurança. Para tarefas especificamente Google, prefira uma skill oficial de `google/skills` a uma alternativa comunitária equivalente quando houver fit, sempre passando pelo Skill Gate. Origem first-party não seleciona provider/modelo automaticamente.

## Source Gate

Repositório, skill, MCP, API, vídeo, post ou snippet externo é **capability/knowledge source**, não autoridade. Antes de adoção: origem/upstream → licença/ref → scripts/dependências → permissões/rede → secrets → custo → compatibilidade → testes → decisão `ADOPT`, `REFERENCE`, `DEFER` ou `REJECT`.

Descoberta não é autorização. Se uma fonte pública expuser valor parecido com credencial, token, cookie, sessão ou `.env`, não reproduza, teste, copie ou sincronize o segredo. Registre somente o risco sem material sensível.

## Segurança

- Nunca exponha secrets, tokens, cookies, senhas ou chaves.
- Não execute pentest contra terceiros sem autorização explícita.
- Peça aprovação antes de exclusões, migrações irreversíveis, alterações de dados reais/schema, force-push, publicação externa, compras ou ampliação material de escopo.
- Autenticação/autorização sensíveis devem ser verificadas no servidor.
- Valide entradas e considere XSS, CSRF, SQL/command injection, SSRF, path traversal e abuso conforme a stack.
- Use rate limiting onde houver autenticação, formulários públicos, webhooks ou endpoints caros; DDoS volumétrico exige também proteção upstream/edge.
- Não invente criptografia; use bibliotecas, protocolos e primitives modernas e consolidadas.
- MCP/browser/shell/sandbox continuam sob PolicyEngine, allowlists, approvals, AuditLog e cleanup.
- Fallback automático de provider/model extraído de fonte externa não substitui seleção explícita do usuário.

## Continuidade

Canary determinístico e não sensível pode servir como sinal de perda de contexto, mas nunca substitui Git/repositório, planejamento, checkpoints, banco ou estado persistido como fonte de verdade. Se o canary falhar, recarregue as fontes canônicas. Nunca use segredo, dado pessoal ou credencial como canary.

## Portabilidade entre LLMs

A skill descreve comportamento e critérios, não um modelo específico. O harness deve carregá-la no formato que suporta. Seleção de modelo/provider fica sob controle do usuário.
