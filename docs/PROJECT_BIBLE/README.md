# Tupiniquim AI Dev Studio — Project Bible

Atualizado em: 2026-09-22

Este diretório é o pacote documental canônico de leitura executiva e operacional do projeto. Ele **não substitui** `AGENTS.md`, `.agent/MASTER_PLAN.md`, `.agent/REQUIREMENTS.md`, ADRs, testes ou o estado real do Git; ele organiza essas fontes para reduzir perda de contexto, divergência documental e decisões baseadas em memória de chat.

## Ordem de leitura

1. `BIBLIA_DO_PROJETO.md` — visão integral, escopo, arquitetura, estado, fases e Definition of Done.
2. `BACKLOG_E_STATUS.md` — concluído, em andamento, bloqueado e pendente, incluindo a RC1 e o mapeamento Agenor.
3. `QA_RELEASE_SECURITY.md` — estratégia de testes, gates, release, segurança e evidência.
4. `MODELOS_PROVIDERS_AGENTES.md` — separação Agent/Model/Provider/Tool/Skill, providers atuais e roadmap multi-modelo/multiagente.
5. `MERCADO_PRECIFICACAO_E_VALOR.md` — benchmarks de mercado, custo de reposição e hipóteses de monetização.
6. `AGENOR_SYNC.md` — protocolo de sincronização GitHub → Agenor → Notion/Miro.
7. `PROMPT_MANTENEDOR_BIBLIA.md` — prompt profissional para futuros agentes manterem a documentação viva.

## Fontes de verdade

Prioridade em caso de conflito:

1. Git, código, testes e artefatos executados no HEAD auditado.
2. `AGENTS.md` e regras canônicas do repositório.
3. `.agent/MASTER_PLAN.md`, `.agent/REQUIREMENTS.md`, ADRs, `.agent/STATUS.md`, `.agent/TEST_RESULTS.md`.
4. `docs/RC1/*`, Issues e Pull Requests do GitHub.
5. Este Project Bible.
6. Notion/Miro/Agenor como espelho operacional.
7. Relatórios de agentes e conversas, somente quando confirmados por evidência.

## Regra de manutenção

Nenhuma tarefa pode ser marcada como concluída apenas por relatório de agente. Um status `PASS` exige evidência verificável no ambiente correspondente. Mudanças de arquitetura, escopo, provider, modelo, segurança ou custo devem atualizar esta documentação e produzir `AGENOR_UPDATE`.
