# Tupiniquim AI Toolbox — Repositórios de Referência

Atualizado em 2026-09-03.

Este catálogo é a fonte de referência para Claude Code e para os projetos da Tupiniquim. Os repositórios externos devem ser tratados como **fontes brutas de referência**, não como dependências obrigatórias. Antes de copiar código ou adicionar dependências, verifique licença, atividade, compatibilidade, segurança e necessidade real.

## Repositórios fornecidos

| Repositório | Papel na empresa | Integração com Claude | Política de uso |
|---|---|---|---|
| Panniantong/Agent-Reach | Pesquisa e acesso a fontes/web para agentes | Skill compatível com Claude Code; pode ser instalada com `npx skills add Panniantong/Agent-Reach@agent-reach` | Usar para pesquisa e coleta; respeitar autenticação, ToS e privacidade |
| nextlevelbuilder/ui-ux-pro-max-skill | Direção UI/UX, design system e QA visual | Plugin/skill Claude; instalação global suportada pelo CLI `uipro init --ai claude --global` | Referência principal para UI/UX quando aplicável; não substituir requisitos do projeto |
| Anil-matcha/Open-Generative-AI | Laboratório de mídia generativa e integrações | Referência de arquitetura; não carregar automaticamente como skill | Usar módulos/padrões apenas quando o projeto precisar de geração de imagem/vídeo/áudio |
| diwenne/openreply | Automação Instagram comentário→DM via API oficial da Meta | Referência de implementação | Priorizar API oficial, webhooks, rate limiting, filas e logs; não copiar secrets |
| kyutai-labs/pocket-tts | TTS local leve, CPU, streaming e clonagem de voz | Referência/módulo executável | Considerar para voz local/offline; validar licença de vozes e consentimento |
| FareedKhan-dev/kimi-k3-in-c | Pesquisa de inferência Kimi K3 em C99/CPU | Referência experimental | Não tratar como runtime padrão; o checkpoint é enorme e exige avaliação de hardware/armazenamento |
| HKUDS/CLI-Anything | Tornar software agent-native via CLI | Plugin Claude Code via marketplace | Usar quando houver ganho real em expor software/fluxos via CLI; exigir testes E2E |
| nidhinjs/prompt-master | Engenharia de prompts para múltiplas IAs | Skill Claude; pode viver em `~/.claude/skills/prompt-master` | Usar para criação/adaptação de prompts, não como substituto de análise técnica |
| Shubhamsaboo/awesome-llm-apps | Biblioteca de agentes, skills e apps LLM/RAG | Contém skills instaláveis individualmente | Minerar padrões e componentes; adotar apenas o que tiver fit com o projeto |

## Repositório identificado nos vídeos

| Repositório | Evidência | Uso aprovado |
|---|---|---|
| usestrix/strix | O vídeo de segurança mostra o Strix como agente de pentest; o repositório oficial oferece skills para Claude Code | Usar **somente** em sistemas próprios ou com autorização explícita, preferencialmente em ambiente de teste/staging e CI |

## Regra de seleção

Claude deve escolher a referência pelo problema, não pela popularidade:

- UI/UX e design system → UI UX Pro Max.
- Engenharia de prompts → Prompt Master.
- Pesquisa/web/social → Agent Reach.
- Pentest e remediação de segurança → Strix, apenas com autorização.
- Automação de software via CLI → CLI-Anything.
- Aplicações/agentes/RAG → Awesome LLM Apps.
- Automação Instagram → OpenReply.
- Voz/TTS local → Pocket TTS.
- Mídia generativa → Open Generative AI.
- Pesquisa de inferência extrema/local → kimi-k3-in-c.

## Regras de adoção

1. Nunca instalar dependência ou executar script externo apenas porque aparece neste catálogo.
2. Inspecionar README, licença, releases, dependências e riscos antes de adotar.
3. Preferir integração modular, feature flag e rollback simples.
4. Nunca commitar chaves, cookies, tokens, credenciais ou arquivos locais de sessão.
5. Para repositórios de segurança/pentest, operar apenas em alvos próprios/autorizados.
6. Registrar no issue/PR qual referência foi usada e o que foi adaptado.
7. Manter cópia bruta local pelo script `scripts/sync-ai-toolbox.ps1`.
