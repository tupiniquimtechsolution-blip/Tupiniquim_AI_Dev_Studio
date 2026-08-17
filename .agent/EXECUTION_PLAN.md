# Plano de Execução

Plano histórico de 13 ondas. O plano operacional vigente é `MASTER_PLAN.md`: a antiga Wave 4 corresponde à Wave Mestre 0. Cada wave fecha somente após teste, correção, revisão, atualização de status e checkpoint Git.

| Onda | Entrega | Estado |
|---:|---|---|
| 0 | Auditoria, pesquisa, documentos, ADRs e baseline | CONCLUÍDA |
| 1 | Fundação Electron/React segura | CONCLUÍDA |
| 2 | Workspace Engine | CONCLUÍDA |
| 3 | Terminal e Git | CONCLUÍDA |
| 4 | AIProvider e Codex App Server | EM ANDAMENTO |
| 5 | Plan/Approval/Execute | PENDENTE |
| 6 | Research, scraping e Technology Resolver | PENDENTE |
| 7 | Prompt Architect | PENDENTE |
| 8 | Visual Intelligence | PENDENTE |
| 9 | HUD, temas e layouts | PENDENTE |
| 10 | Preview e edição visual básica | PENDENTE |
| 11 | QA, segurança e hardening | PENDENTE |
| 12 | Dogfood A–K, pacote e entrega | PENDENTE |

## Sequência operacional

`TESTE → CORRIJA → REVIEW → STATUS → CHECKPOINT GIT → PRÓXIMA ONDA`

As ondas 1–3 compartilharam um gate integrado por atravessarem o mesmo processo Electron e contratos IPC. Os checkpoints permanecem identificáveis por commits/tags individuais; cada checkpoint aponta para um estado novamente validado.

## Checkpoint

- Commit com prefixo `wave-NN:`.
- Tag anotada `checkpoint/wave-NN`.
- Working tree limpa antes da próxima mudança funcional.
- `.agent/STATUS.md` contém evidência, comandos e limitações reais.
