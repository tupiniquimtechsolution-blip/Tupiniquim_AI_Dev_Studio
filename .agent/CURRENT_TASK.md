# Tarefa atual

Atualizado em: 2026-09-28

## Objetivo

Levar a edição **Tupiniquim Dev AI Web Full** do estado de código/CI CLOUD-GREEN para um candidate implantado e certificável, sem remover Sandbox/Containers e sem declarar PASS de capacidades ainda não comprovadas em produção.

## Linha ativa

- Branch canônica: `integration/ai-lab-toolbox-unified`
- Baseline reconciliado: `4cf2660e2cf2f1ca2f5a71fd0f3c551d67b9eca8`
- PR unificado histórico: #50
- Blocker de deploy: #53
- Hardening de hostname/Access: #59
- Certificação física USB/SSD: #51 — trilha separada, não bloqueia Web

## Estado técnico já implementado

- Workers AI é provider real e separado de Ollama.
- Provider/runtime/model têm identidades distintas.
- modelo padrão Web e allowlist existem.
- `/workspace` faz bootstrap automático.
- R2 backup/restore está implementado, porém desativado até configuração cloud real.
- Cloudflare Access JWT está implementado, porém modo anônimo continua ativo para teste.
- Service Auth headless é suportado via JWT Access validado.
- Web Product Smoke workflow está implementado.
- Terminal Web identifica Cloudflare Sandbox corretamente.
- Cloud Quality dos PRs #52/#54/#55/#56/#57/#58 ficou GREEN.

## Blocker atual

O deploy Cloudflare falha após build/upload ao consultar:

`/accounts/.../containers/me`

Classificação: **INFRASTRUCTURE / ACCOUNT / ENTITLEMENT / TOKEN**, Issue #53.

Não classificar esse erro como bug de código e não remover Sandbox para contorná-lo.

## Critério de conclusão da tarefa

A tarefa Web atual só termina quando um exact SHA comprovar:

1. deploy Cloudflare completo;
2. Containers/Sandbox disponível;
3. `/api/health` funcional;
4. Access de produção READY;
5. workspace persistence READY;
6. modelo/provider Web corretos;
7. Chat/Enviar real;
8. resposta Workers AI;
9. workspace write/read;
10. terminal WebSocket real;
11. reload/session recovery;
12. restart/restore do workspace;
13. nenhum hostname alternativo contorna Access;
14. Web Product Smoke `production_ready=true` GREEN;
15. rollback/evidência documentados.

## Regra de execução

- GitHub primeiro para qualquer dúvida.
- reproduzir → evidenciar → corrigir mínimo → CI → deploy → product smoke.
- BUILD PASS não promove produto.
- infraestrutura ausente = BLOCKED/NOT_CONFIGURED, nunca PASS.
