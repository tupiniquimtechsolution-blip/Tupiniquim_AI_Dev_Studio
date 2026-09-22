# Backlog e Status Canônico

Atualizado em: 2026-09-22

Este ledger resume o que está concluído, em andamento, bloqueado e pendente. Status operacional deve ser refletido pelo Agenor no Notion/Miro, mas GitHub/evidência real continua sendo a fonte primária.

## Concluído

- Master Wave 0 — fundação confiável.
- Wave 15 — continuity/conversation.
- Wave 16 — restart/recovery; checkpoint remoto confirmado anteriormente.
- Provider-neutral/provenance e persistência principal trabalhados nas Waves 13–16.
- Correção de auth boundary do Codex e reconnect do provider selecionado.
- Integração de Google Tasks preservada na RC1.
- RC1 integra linha Wave17 + `main` sem merge em `main`.
- Setup/build/run/verify Windows entregues.
- Manifesto local de modelos entregue.
- Correção Windows PowerShell 5.1 do probe Node aplicada na mesma RC1.
- Technology Resolution Engine basal funcional.
- Workspace real básico, edição/salvamento/diff, status/diff Git, persistência de sessão/plano/aprovação/eventos, HTTP research e preferências parciais existentes.

## Em andamento agora

### Agenor #18 — RC1 Consolidation / fechamento Master Wave 1
Objetivo: transformar a RC1 em uma V1 realmente utilizável no Windows F:, corrigindo blockers no mesmo PR/linha de integração.

Estado atual:
- setup Windows sendo executado/validado no hardware real;
- branch `arena/01a0c8ba-tupiniquim-ai-dev-studio`;
- PR #32 DRAFT concentra a RC1;
- RC1 ainda NÃO aprovada como V1.

## Pendências V1 — obrigatórias antes do fechamento

### P-V1-01 — Files UX
Criar/buscar arquivos completos no renderer; regressões de path protection e atomic write.

### P-V1-02 — Terminal completo
Fluxo de aprovação utilizável para `terminal.write`; múltiplas sessões; cancelamento; timeout; erros visíveis.

### P-V1-03 — Git completo
Commit, checkpoint e restauração segura, sempre com policy/approval/audit.

### P-V1-04 — Provider real
Homologar Codex autenticado no CODEX_HOME isolado e Ollama com inferência real; estados READY/AUTH_REQUIRED/NOT_CONFIGURED/ERROR explícitos.

### P-V1-05 — Modes completos
EXECUTE como orquestrador real; VISUAL como fluxo de asset/transformação real; manter CHAT/PLAN/RESEARCH/REVIEW/DEBUG/PROMPT funcionais.

### P-V1-06 — Evidence/Test Runner
Integrar execução de quality suites e visualização de evidências na UI; remover aba Testes “morta” somente quando houver implementação real.

### P-V1-07 — Autonomy Profiles
Seletor e persistência SAFE/ASSISTED/AUTONOMOUS/FULL_ACCESS sem bypass da PolicyEngine.

### P-V1-08 — Browser-second
Integrar browser QA/research após HTTP-first, com provenance e limites de rede.

### P-V1-09 — Prompt Architect UI
Comparar, compilar, exportar, validar e versionar de ponta a ponta.

### P-V1-10 — Visual Lab completo
Cadastro/transformação/provenance/licença e bloqueio de assets de direitos desconhecidos.

### P-V1-11 — Preferences completas
Atalhos configuráveis/persistentes, além de tema/densidade/layout.

### P-V1-12 — Preview
Expor PreviewAdapter via IPC/renderer, runtime empacotado, viewport responsivo e isolamento.

### P-V1-13 — Windows packaging/gates
Gerar/homologar executável, `validate`, E2E, ConPTY, smoke desktop, restart/recovery.

### P-V1-14 — Google Tasks real
Homologar OAuth desktop humano e fluxo funcional sem credencial automática; sem tokens no renderer.

### P-V1-15 — Closeout
Auditoria externa, changelog/known issues/test results/status/handoff, Issue #24 GREEN, checkpoint/tag Master Wave 1.

## Master Wave 2 — pendente após V1

- Research Agent completo.
- Knowledge/RAG Registry por projeto com citations.
- Technology Registry ampliado.
- Tool Registry.
- MCP Registry.
- Skill Registry + Skill Gate (licença, custo, permissões, dependências, provenance, aprovação).
- Catálogos de conhecimento/design como fontes não autoritativas e loadouts sob demanda.

## Master Wave 3 — pendente

- Dev Studio completo e hardening.
- Browser QA ampliado.
- Playbooks de engenharia e quality gates.
- Dogfood de fluxos completos de desenvolvimento.
- Release/process hardening.

## Master Wave 4 — pendente

- Materialização do Agent Registry em contratos/runtime.
- Master Planner.
- Researcher.
- UI/UX Designer.
- Prompt Architect agent.
- Tool/CLI Integrator.
- Knowledge/RAG agent.
- Trust/QA Reviewer.
- Coding Worker consolidado.
- Agents → Projects/Threads, equipes, loadouts e memória isolados por projeto.

## Master Wave 5 — pendente

- Illustrator/Media Agent.
- Open Generative AI capability source.
- Image generation/editing e video workflows.
- Presets/aliases de vídeo internos.
- Voice/TTS local e consentimento/provenance para voice cloning.
- Social Automation via APIs oficiais.
- Multimodal conforme hardware e orçamento.

## Pendências transversais

- Catálogo local multi-modelo por capacidades, não Qwen-only.
- Benchmark de modelos em hardware real.
- Matriz de compatibilidade modelo × tool calling × context × RAM/VRAM.
- Reprodutibilidade de dependências/downloads.
- Licenças de repos/skills/assets.
- Observabilidade e export de audit/evidence.
- Disaster/recovery/backup de dados operacionais.
- Documentação de instalação, operação, troubleshooting e release.
- Estratégia comercial/licenciamento e suporte.

## Critério para concluir uma task

`Concluída` exige: código/artefato no HEAD correto + teste/evidência adequada + ausência de blocker conhecido para o escopo + documentação/Agenor atualizados. Relato de agente sem evidência não fecha task.
