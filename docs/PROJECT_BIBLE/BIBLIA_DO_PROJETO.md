# BÍBLIA DO PROJETO — TUPINIQUIM AI DEV STUDIO

Atualizado em: 2026-09-22  
Escopo documental: produto, engenharia, operação, QA, roadmap e governança.

## 1. Identidade e missão

O Tupiniquim AI Dev Studio é um desktop AI-first para desenvolvimento de software com foco em execução local, segurança, autonomia controlada, rastreabilidade e independência de um único modelo/provider.

Invariante central:

**Agent != Model != Provider != Tool != Skill != Source Repository**

O usuário escolhe provider/modelo; o sistema não deve impor prioridade automática. Operações mutáveis passam por PolicyEngine, ApprovalStore e AuditLog.

## 2. Fonte de verdade e governança

Em caso de conflito, prevalecem Git/código/testes do HEAD auditado. A documentação histórica não pode sobrepor comportamento comprovado. Relatórios de agentes são evidência secundária até confirmação externa.

Ambiente operacional atual: `F:\CODEX\Tupiniquim-AI-Dev-Studio`; dados controláveis em `F:\CODEX\Tupiniquim-AI-Dev-Studio.data` ou caminhos autorizados equivalentes.

Regras permanentes: renderer sem Node privilegiado; IPC tipado/allowlisted; CSP/sandbox; segredos fora de logs/Git/prompts; nenhum reset destrutivo/force push; nenhuma seleção automática de provider/modelo; serviços pagos `NOT_CONFIGURED` até autorização explícita.

## 3. Estado executivo auditado

- Master Wave 0: **CONCLUÍDA** — fundação, isolamento, AIProvider, persistência, IPC/PolicyEngine, E2E e redaction.
- Master Wave 1: **EM ANDAMENTO** — Wave 16 fechada; Wave 17/RC1 ainda é o gate de fechamento.
- RC1 integrada: branch `arena/01a0c8ba-tupiniquim-ai-dev-studio`.
- Base integrada: Wave17 + `main`/Google Tasks.
- RC1 não pode ser chamada V1 aprovada: existem lacunas funcionais reais, além de gates Windows.
- Master Waves 2–5: **PENDENTES** e formalmente posteriores ao fechamento da Master Wave 1.

## 4. Produto V1 — requisitos oficiais

RF-01 Workspace: criar/abrir projetos autorizados.  
RF-02 Arquivos: mapear/buscar/ler/criar/editar, escrita atômica e diff.  
RF-03 Terminal: PTY real, múltiplas sessões, cancelamento e timeout.  
RF-04 Git: status/diff/commit/checkpoint/restauração segura.  
RF-05 IA: AIProvider provider-neutral, atualmente Codex App Server + Ollama.  
RF-06 Modos: CHAT, PLAN, RESEARCH, EXECUTE, REVIEW, DEBUG, PROMPT, VISUAL.  
RF-07 Persistência: planos, steps, executions, approvals, events, testes e auditoria.  
RF-08 Perfis: SAFE, ASSISTED, AUTONOMOUS, FULL_ACCESS.  
RF-09 Research: HTTP-first + browser-second com fontes/confiança/provenance.  
RF-10 Technology Resolver: WEB/DESKTOP/MOBILE com decisão explicável.  
RF-11 Prompt Architect: criar/versionar/comparar/validar/exportar prompts.  
RF-12 Visual Lab: assets, transformações, provenance/licença e bloqueio de direitos desconhecidos.  
RF-13 Preferências: tema, densidade, atalhos, layout.  
RF-14 Preview: servidor local supervisionado, isolamento e viewport responsivo.  
RF-15 Quality: executar testes, apresentar evidências e recuperar falhas.

## 5. Situação V1/RC1 por requisito

- RF-01: essencialmente implementado; precisa continuar no smoke Windows.
- RF-02: leitura/edição/salvar/diff existem; faltam fluxo completo de criação e busca na UI.
- RF-03: ConPTY existe; faltam fluxo de aprovação de input realmente utilizável, multissessão e timeout na UI.
- RF-04: status/diff existem; commit/checkpoint/restauração ainda faltam.
- RF-05: contratos/adapters existem; ainda falta homologação real Codex autenticado + inferência Ollama no Windows.
- RF-06: oito modos aparecem; EXECUTE não é orquestrador completo e VISUAL não faz transformação completa.
- RF-07: persistência principal existe; evidência/test execution integrada continua incompleta.
- RF-08: PolicyEngine tem quatro perfis; falta seletor/runtime completo.
- RF-09: HTTP-first existe; browser-second falta integração.
- RF-10: implementado/testado no core e ligado ao Research.
- RF-11: criação/lint/versionamento existem; comparação/exportação/compilação precisam de UI completa.
- RF-12: licenças existem; transformação/cadastro visual completo falta.
- RF-13: tema/densidade/layout persistem; atalhos configuráveis faltam.
- RF-14: PreviewAdapter existe, mas não está ligado ao IPC/renderer/runtime de pacote.
- RF-15: suítes externas existem; falta executor de testes/evidências integrado ao produto.

## 6. Master Waves e roadmap integral

### Master Wave 0 — Fundação confiável — CONCLUÍDA
Isolamento, AIProvider, SQLite/persistência, fronteiras IPC, PolicyEngine, redaction, E2E e segurança basal.

### Master Wave 1 — Dev AI local autônomo — EM ANDAMENTO
Runtime local, workspace, conversa, memória, session/thread, proposals/approvals, provider provenance, restart/recovery e dogfood final. Gate: Windows real sem bloqueios críticos/altos, `validate`, E2E, continuidade, privacidade e documentação final.

### Master Wave 2 — Research/Knowledge/Registries — PENDENTE
Research Agent; Knowledge/RAG Registry isolado por projeto; citations; Technology/Tool/MCP/Skill Registries; Public APIs como discovery; Skill Gate com licença/custo/dependências/permissões/provenance; fontes de design e conhecimento sob loadout explícito.

### Master Wave 3 — Dev Studio completo / hardening — PENDENTE
Completar experiência de desenvolvimento, execução/test/review/checkpoint, preview, hardening, playbooks de engenharia, browser QA e dogfood ampliado. Nenhum framework externo vira autoridade automaticamente.

### Master Wave 4 — Tupiniquim AI Studio multiagente — PENDENTE
Materializar `.agent/AGENT_REGISTRY.json` em contratos/runtime; Agents → Projects/Threads; equipes; memória/loadouts por projeto; capabilities sob PolicyEngine; provider/modelo separados de agente.

### Master Wave 5 — Multimodal, mídia, automação e voz — PENDENTE
Illustrator/Media Agent; Open Generative AI como capability source; aliases internos de vídeo; TTS/voz local; automação social via APIs oficiais; multimodal conforme hardware; provenance/licenças/consentimento obrigatórios.

## 7. Integrações atuais e previstas

Atuais/RC1: Codex App Server, Ollama, Google Tasks, Git, filesystem, PTY/ConPTY, Research HTTP, SQLite, Prompt Architect parcial, Technology Resolver, Visual/Preview adapters parciais.

Previstas: MCP/Tool/Skill Registry; RAG/Knowledge; browser-second; Agent Registry runtime; media/image/video; TTS; social automation; loadouts; project-scoped teams.

## 8. Models/providers

A RC1 instala automaticamente somente modelos Qwen no manifesto local, mas a arquitetura **não é Qwen-only**. Ollama deve detectar qualquer modelo instalado; catálogo futuro deve ser capability-based e user-controlled. Providers atuais: Codex App Server e Ollama. Providers futuros só entram após contrato, segurança, provenance, testes e autorização.

## 9. Definition of Done V1

A V1 só é aprovada quando: aplicativo Windows empacotado abre; workspace faz criar/buscar/ler/editar/diff/salvar; terminal e Git reais funcionam; Codex e Ollama são utilizáveis sem esconder auth/runtime failures; um PLAN aprovado executa com review/checkpoint; Research produz fontes/confiança/Knowledge Pack; Prompt Architect e Technology Resolver são utilizáveis; Visual Lab controla direitos; preferências/preview/histórico sobrevivem ao restart; `pnpm validate` e dogfood integral ficam GREEN.

## 10. Definition of Done do projeto completo

Além da V1: Wave2 Research/Knowledge/Registries funcional; Wave3 Dev Studio hardening; Wave4 Agent Registry multiagente real; Wave5 multimodal/voz/automação; segurança, licenças, custos e provenance rastreáveis; release reproduzível; documentação e operação atualizadas; backlog sem crítico/alto conhecido para o escopo declarado.

## 11. Riscos principais

1. Divergência entre documentação histórica e estado real — mitigar por Git/testes como autoridade.
2. Escopo crescer antes da V1 — congelar features novas até fechar gaps V1.
3. Model lock-in — preservar provider-neutral e catálogo multi-modelo.
4. Aprovações virarem bloqueio de UX — testar fluxos privileged end-to-end.
5. Offline/local em hardware limitado — tiers de modelos e capability detection.
6. Segurança/segredos — isolamento, redaction, OAuth seguro, nenhum auto-login/copy credential.
7. External repos/skills inseguros — gate de licença/provenance/permissões/custo.
8. Testes verdes sem produto utilizável — smoke humano, desktop Windows e evidência real obrigatórios.

## 12. Prioridade operacional imediata

1. Concluir setup RC1 no Windows e registrar falhas reais.
2. Corrigir todos os blockers V1 na mesma RC/PR, sem criar novas Waves artificiais.
3. Homologar pacote Windows, E2E, Codex, Ollama, ConPTY e Google Tasks.
4. Fechar todos os RF-01..RF-15 com evidência.
5. Auditoria externa + documentação final + checkpoint Master Wave 1.
6. Só então liberar Master Wave 2.

## 13. Política documental

Todo merge/release deve atualizar: `STATUS`, `TEST_RESULTS`, handoff, changelog, known issues, Project Bible e `AGENOR_SYNC`. Todo bug crítico/alto vira item rastreável. Notion/Miro não substituem GitHub; são espelhos de execução e planejamento.
