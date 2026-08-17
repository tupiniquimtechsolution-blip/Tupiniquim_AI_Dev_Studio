# ADR 0011 — Projeto e toolchain local em D:\CODEX

Status: Aceito

O volume que hospedava a instalação controlada anteriormente referenciada como F: está disponível nesta máquina como D:. A raiz operacional é `D:\CODEX\Tupiniquim-AI-Dev-Studio`, os dados locais ficam em `D:\CODEX\Tupiniquim-AI-Dev-Studio.data` e o toolchain compartilhado em `D:\CODEX\programas`.

Código, dependências, caches, dados, logs, temporários, builds e pacotes controláveis permanecem em `D:\CODEX`. Os demais projetos irmãos permanecem isolados. Este ADR substitui o ADR 0010 somente quanto à localização física; as decisões de isolamento e de dados locais continuam válidas.
