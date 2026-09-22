# Agenor — Protocolo de Sincronização

Atualizado em: 2026-09-22

## 1. Objetivo

Agenor é o concentrador operacional de planejamento e rastreabilidade do projeto. Ele mantém Notion e Miro alinhados com o estado verificável do GitHub sem transformar nenhum deles em fonte de verdade superior ao código/testes.

Cadeia de verdade:

**GitHub/evidência real → Agenor → Notion numerado → Miro visual → resposta no chat**

## 2. Semântica das tasks

- `Sequência` é o número local do projeto (`todo #N`).
- O ID global do Notion continua sendo identidade global.
- Não renumerar silenciosamente tasks existentes.
- Status permitido: A Fazer / Em Andamento / Aguardando / Bloqueada / Concluída.
- Número não é prioridade.
- Dependências devem aparecer explicitamente, ex.: `depende da #18`.

## 3. Regra fail-closed

Só declarar “sincronizado” quando o sistema de destino realmente foi atualizado. Se Miro estiver bloqueado, registrar `MIRO_SYNC_BLOCKED` e manter Notion como espelho operacional temporário; o GitHub continua autoridade.

## 4. Payload obrigatório

Toda wave, bug, release ou decisão relevante deve gerar:

```text
AGENOR_UPDATE
projeto:
wave:
etapa:
tarefa_id:
titulo:
tipo:
status:
prioridade:
branch:
head:
pr:
issue:
arquivos:
evidencias:
riscos:
dependencias:
proximo_passo:
notion_update:
miro_update:
```

## 5. Backlog que o Agenor deve refletir agora

### Em andamento
- #18 — RC1 Consolidation / fechamento Master Wave 1: setup, correção de blockers V1, gates Windows, auditoria e closeout.

### Concluídas relevantes
- reconnect seguro do provider selecionado;
- auditoria/fast-forward do reconnect;
- validate + E2E Windows do head anterior;
- sync Toolbox/Knowledge Packs já confirmado anteriormente.

### Pendências imediatas dentro do #18
- completar setup RC1 no Windows;
- corrigir qualquer erro real do setup/verify no mesmo PR;
- fechar RF-02, RF-03, RF-04, RF-05, RF-06, RF-07/15, RF-08, RF-09, RF-11, RF-12, RF-13, RF-14;
- homologar package/E2E/providers/OAuth;
- closeout da Master Wave 1.

### Pendências posteriores
- Master Wave 2: Research/Knowledge/Technology/Tool/MCP/Skill Registries;
- Master Wave 3: Dev Studio completo/hardening;
- Master Wave 4: Agent Registry multiagente;
- Master Wave 5: multimodal/media/voz/automação.

## 6. Regra para bugs encontrados no Windows

Não criar nova Wave. Registrar como subitem/bug do #18 com severidade, evidência, commit de correção e teste de regressão. Somente abrir task numerada separada quando o bug tiver vida própria, dependências ou duração que justifique rastreamento autônomo.

## 7. Fechamento do #18

#18 só vira `Concluída` quando V1 estiver aprovada por evidência: RF-01..15 aceitos, Windows package/gates GREEN, providers reais validados, nenhum blocker crítico/alto, documentação final atualizada e auditoria externa concluída.

## 8. Documentação viva

Ao fechar cada marco, atualizar também `docs/PROJECT_BIBLE/*`, `.agent/STATUS.md`, `.agent/TEST_RESULTS.md`, handoff/changelog/known issues aplicáveis, PR/Issue correspondente e os espelhos Notion/Miro.
