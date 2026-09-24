# MW5 — Source Review

Data: 2026-09-24

Este documento registra somente fatos observados nas fontes revisadas. Fonte externa permanece não confiável para autoridade de runtime.

## Anil-matcha/Open-Generative-AI

Repositório público ativo. A documentação atual descreve um estúdio de imagem/vídeo/áudio com múltiplos modelos, providers externos e dois caminhos locais no desktop: `sd.cpp` e cliente para servidor Wan2GP. A hosted version/white-label usa MuAPI e pode envolver custos/credenciais.

Decisão MW5:
- usar como `CAPABILITY_SOURCE`, não como provider automático;
- nenhuma API key ou provider pago é configurado automaticamente;
- provider/model continuam seleção externa ao Agent;
- local inference real continua dependente de hardware e certificação local.

## internal:gemini-video-presets

Aliases versionados: `/reveal`, `/teardown`, `/explodedview`.

Decisão MW5:
- continuam aliases internos de prompt;
- `officialGeminiCommand=false` permanece obrigatório;
- não implicam provider Gemini configurado nem autorizam geração.

## kyutai-labs/pocket-tts

Repositório público ativo. A documentação descreve TTS leve em CPU, Python API, CLI, servidor HTTP local, streaming, múltiplos idiomas (incluindo português) e voice cloning a partir de áudio/voice state.

Decisão MW5:
- registrar como source local de `AGENT-VOICE`;
- execução local real fica `WINDOWS_DEFERRED` no gate cloud quando não reproduzível;
- voice cloning exige consentimento explícito e provenance da amostra;
- nenhuma amostra de voz é ingerida ou executada automaticamente.

## diwenne/openreply

Repositório público ativo, MIT. A documentação descreve automação Instagram comment-to-DM via API oficial Meta, sem scraping/browser automation. Operação real requer implantação própria, URL HTTPS pública, PostgreSQL, Redis, worker e conexão Instagram (Meta direta ou provider opcional).

Decisão MW5:
- registrar como source de `AGENT-SOCIAL`;
- `network:external-write` só pode virar proposta quando API oficial for confirmada e a source estiver explicitamente configurada;
- rate limits/terms/consent permanecem requisitos;
- sem secrets Meta versionados e sem deploy automático de OpenReply.

## kimi-k3-in-c

A busca por nome retorna múltiplos repositórios homônimos/forks; não há no registry atual um owner/repository canônico pinado.

Decisão MW5:
- manter `EXPERIMENTAL_RESEARCH_ONLY`;
- não integrar ao Agent Registry runtime;
- não criar provider/model/runtime automático até existir source canônica pinada e auditada.

## Regra de confiança

Descoberta/registro de source != adoção != configuração != aprovação != execução.
