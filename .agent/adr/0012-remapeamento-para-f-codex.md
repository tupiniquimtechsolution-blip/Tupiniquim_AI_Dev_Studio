# ADR 0012 — Remapeamento operacional para F:\CODEX

Status: Aceito

O mesmo volume e o mesmo projeto usados na estação anterior estão disponíveis nesta máquina sob a letra `F:`. A raiz operacional é `F:\CODEX\Tupiniquim-AI-Dev-Studio`, os dados locais ficam em `F:\CODEX\Tupiniquim-AI-Dev-Studio.data` e o toolchain compartilhado em `F:\CODEX\programas`.

Código, dependências, caches, dados, logs, temporários, builds e pacotes controláveis permanecem em `F:\CODEX`. Os demais projetos irmãos permanecem isolados. Este ADR substitui o ADR 0011 somente quanto à localização física; preserva a cadeia histórica dos ADRs 0010 e 0011 e todas as decisões de isolamento e segurança.
