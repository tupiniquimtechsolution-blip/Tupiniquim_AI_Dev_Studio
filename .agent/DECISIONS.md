# Decisões operacionais

## 2026-08-20 — Remapeamento do mesmo projeto para F:

Após a troca de máquina, o mesmo volume do projeto está montado como `F:`. O repositório ativo confirmado é `F:\CODEX\Tupiniquim-AI-Dev-Studio`, com dados em `F:\CODEX\Tupiniquim-AI-Dev-Studio.data` e toolchain em `F:\CODEX\programas`. O ADR 0012 substitui o ADR 0011 somente para localização física.

Comandos Git automatizados continuam usando `git -c safe.directory=F:/CODEX/Tupiniquim-AI-Dev-Studio` por invocação quando necessário; a configuração global do usuário não é alterada.

## 2026-08-17 — Letra de volume operacional

O ambiente atual hospeda o projeto, dados e toolchain controlados em D:. O repositório ativo confirmado é `D:\CODEX\Tupiniquim-AI-Dev-Studio`; a variante com `_` não existe. ADR 0011 substitui o ADR 0010 apenas para localização.

## 2026-08-17 — Segurança Git local

O checkout possui proprietário Windows diferente do processo atual. Comandos automatizados usam `git -c safe.directory=D:/CODEX/Tupiniquim-AI-Dev-Studio` por invocação; não será alterada a configuração global do usuário.
