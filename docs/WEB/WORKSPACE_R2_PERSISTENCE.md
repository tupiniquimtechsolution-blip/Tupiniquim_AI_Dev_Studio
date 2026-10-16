# Web — R2 como extensão opcional de redundância

Status: NÃO OBRIGATÓRIO / EXTENSÃO FUTURA  
Data: 2026-09-30

Este documento substitui o desenho anterior em que R2 era requisito para
persistência do workspace.

A arquitetura canônica zero-custo está em:

`docs/WEB/WORKSPACE_LOCAL_PERSISTENCE.md`

O Tupiniquim Remote Runtime já possui armazenamento e backup local confinados ao
gateway. Portanto o primeiro release Web não depende de credenciais R2.

R2 poderá ser adicionado futuramente como camada adicional de redundância cloud,
com ADR, binding, política de retenção, isolamento por identidade e smoke de
restore próprios.

Não configurar `R2_ACCESS_KEY_ID` ou `R2_SECRET_ACCESS_KEY` apenas para
satisfazer readiness: esses secrets não fazem parte do contrato atual de
persistência local.
