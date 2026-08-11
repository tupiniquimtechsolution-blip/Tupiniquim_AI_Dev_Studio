# ADR 0003 — Fronteiras de processo e IPC

Status: Aceito

Renderer é sandboxed e sem Node. Preload expõe API nominal. IPC é allowlisted, validado com Zod e autorizado pelo PolicyEngine. Preview e browser usam sessões isoladas.

