# Decisões operacionais

## 2026-08-17 — Letra de volume operacional

O ambiente atual hospeda o projeto, dados e toolchain controlados em D:. O repositório ativo confirmado é `D:\CODEX\Tupiniquim-AI-Dev-Studio`; a variante com `_` não existe. ADR 0011 substitui o ADR 0010 apenas para localização.

## 2026-08-17 — Segurança Git local

O checkout possui proprietário Windows diferente do processo atual. Comandos automatizados usam `git -c safe.directory=D:/CODEX/Tupiniquim-AI-Dev-Studio` por invocação; não será alterada a configuração global do usuário.
