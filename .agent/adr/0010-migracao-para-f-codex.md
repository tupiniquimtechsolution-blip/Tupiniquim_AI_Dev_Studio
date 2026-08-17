# ADR 0010 — Projeto e toolchain no SSD F

Status: Substituído pelo ADR 0011 nesta máquina

Este ADR substitui as decisões de localização dos ADRs 0001 e 0008. A raiz oficial do projeto é `F:\CODEX\Tupiniquim-AI-Dev-Studio` e os dados locais ficam em `F:\CODEX\Tupiniquim-AI-Dev-Studio.data`.

Código, dependências, caches, dados, logs, temporários, builds e pacotes controláveis permanecem em `F:\CODEX`. O toolchain compartilhado é carregado de `F:\CODEX\programas`: Node.js/Corepack/pnpm e SDK .NET com o compilador Visual Basic Roslyn. Componentes preexistentes do Windows em outros discos podem ser consultados ou executados somente quando não houver alternativa controlável no SSD e não devem receber artefatos do projeto.
