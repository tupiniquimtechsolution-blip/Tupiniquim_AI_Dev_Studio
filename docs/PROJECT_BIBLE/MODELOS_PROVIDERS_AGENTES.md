# Modelos, Providers, Agentes, Tools e Skills

Atualizado em: 2026-09-22

## 1. Regra de arquitetura

`Agent != Model != Provider != Tool != Skill != Source Repository`

Nenhuma dessas camadas pode assumir autoridade da outra. Provider e modelo permanecem escolhidos pelo usuário, sem prioridade automática.

## 2. Providers atuais

### Codex App Server
Estado: integrado na linha atual. Requisitos: isolamento `CODEX_HOME`, auth explícita, `READY/AUTH_REQUIRED/ERROR` claros, sem copiar credenciais, sem auto-login.

### Ollama
Estado: integrado para modelos locais. Deve listar os modelos reais via runtime, permitir seleção manual, persistir escolha e falhar explicitamente quando indisponível.

## 3. Manifesto RC1 atual

- required: `qwen2.5-coder:3b`
- recommended: `qwen3:8b`
- optional: `qwen2.5-coder:14b`

Isso é apenas o bootstrap da RC1. **O produto não é Qwen-only.** Qualquer modelo Ollama já instalado deve poder ser descoberto; a evolução correta é catálogo multi-modelo capability-based.

## 4. Catálogo local futuro

Cada modelo deverá carregar metadados verificáveis: provider, família, versão/tag, tamanho, quantização, contexto, tool calling, visão, embedding, coding/reasoning/research suitability, RAM/VRAM estimada, benchmark local, licença e provenance.

Tiers sugeridos:
- `required`: pequeno e viável em hardware modesto;
- `recommended`: melhor qualidade com custo local maior;
- `optional`: alto consumo ou uso especializado;
- `detected`: modelo já existente fora do manifesto.

Nenhum modelo deve ser baixado silenciosamente.

## 5. Agentes planejados/registrados

- Master Planner — planejamento, dependências, priorização, handoff.
- Researcher — pesquisa web, fontes, síntese e technology research.
- Illustrator / Media Agent — imagem, edição, vídeo e media workflows.
- UI/UX Designer — design system, responsive, animation review.
- Prompt Architect — geração/revisão/adaptação/routing de prompts.
- Tool / CLI Integrator — descoberta e integração segura de CLI/tools.
- Voice / TTS Agent — TTS local/streaming/voz com consentimento.
- Social Automation Agent — webhooks/keyword routing/APIs oficiais.
- Knowledge / RAG Agent — RAG, hybrid search, knowledge graph, citations.
- Trust / QA Reviewer — quality/security/evidence/approval validation.
- Coding Worker — code/test/fix/refactor no workspace autorizado.

Muitos desses agentes estão hoje como `source-registered`, não como runtime completo. A materialização formal pertence principalmente às Master Waves 2–5.

## 6. Tools / MCP / Skills

Regra: descoberta != autorização. Toda fonte externa precisa gate de licença, segurança, permissões, dependências, custo, provenance e fit arquitetural.

Skill Library planejada: catálogo global + loadout por projeto/agente/tarefa. Skills nunca concedem autoridade mutável por si mesmas.

MCPs e APIs pagos/rede: `NOT_CONFIGURED` por padrão; OAuth/chaves somente por fluxo oficial e autorização explícita.

## 7. Roadmap técnico desta área

1. fechar V1 com Codex/Ollama reais;
2. criar registry de modelos e capability detection;
3. benchmark local por hardware;
4. separar seleção Agent × Provider × Model na UI;
5. Materializar Tool/MCP/Skill Registries na Wave 2;
6. materializar Agent Registry runtime na Wave 4;
7. multimodal/voz/media na Wave 5.

## 8. Critério de adoção de novo provider/modelo

Contrato tipado + estados claros + auth segura + provenance + custos explícitos + testes unit/integration/E2E + fail-closed + seleção manual + documentação + Agenor update. Sem isso, permanece apenas `candidate/source-registered`.
