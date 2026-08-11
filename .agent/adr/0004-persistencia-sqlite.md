# ADR 0004 — Persistência SQLite

Status: Aceito

Usar `node:sqlite` em worker, com WAL, foreign keys, migrations, backups e camada repository. A API experimental não vaza para o domínio e pode ser substituída.

