# Evidências RC1 — Arena Linux, 2026-09-22

Ambiente: Node 24.21.0, pnpm 11.16.0. Dependências instaladas com frozen lockfile. TEMP dos testes portáveis em diretório isolado Arena, **não simula drive F:**.

| Gate executado | Resultado observado |
|---|---|
| lint | PASS, zero warnings |
| typecheck | PASS |
| unit | 214 PASS em 21 arquivos (inclui Google Tasks e regressões RC1) |
| integration | 102 PASS, 4 SKIPPED em 15 arquivos |
| security | 38 PASS em 5 arquivos |
| build | PASS, main/preload/renderer e workers locais Monaco emitidos |
| sanity de distribuição | package.main existe, preload e renderer existem, Google Tasks presente no bundle main |
| E2E | 5 SKIPPED — REQUIRES_WINDOWS_GATE, não PASS |
| Electron runtime | FAIL EXTERNO: tentativa de download do binário retornou fetch failed |
| Windows package / F: / ConPTY | REQUIRES_WINDOWS_GATE |
| Codex real autenticado / OAuth humano / Ollama real | NÃO EXECUTADOS |

Integration skips: detecção Codex real Windows, streaming Codex opt-in, HTTP research live opt-in, ConPTY Windows. O teste ConPTY herdado retornava cedo no Linux e aparecia como PASS; corrigido para SKIPPED explícito.

## Auditoria RF (PASS é escopo funcional verificável, não homologação desktop)

| RF | Resultado | Evidência / motivo exato do FAIL |
|---|---|---|
| 01 | PASS | Workspace real, configure/list/read e proteção de caminho em integration; picker nativo permite criar/abrir pasta. Smoke desktop pendente. |
| 02 | FAIL | Escrita atômica/diff/edição disponíveis; falta UI de criar arquivo/buscar. |
| 03 | FAIL | PTY existe mas entrada bloqueada por política sem fluxo de aprovação; faltam UI multissessão/timeout. |
| 04 | FAIL | Git status/diff reais; commit/checkpoint/restauração ausentes. |
| 05 | FAIL | Adapters e fixtures passam; providers reais autenticados e modelo local não validados neste ambiente. |
| 06 | FAIL | Oito modos acessíveis; EXECUTE e VISUAL não completam os fluxos exigidos. |
| 07 | FAIL | Sessões/planos/approvals/events e recuperação testados; testes/evidências de qualidade não integrados. |
| 08 | FAIL | Quatro perfis no PolicyEngine, runtime fixo em ASSISTED, sem seleção. |
| 09 | FAIL | HTTP-first e fontes implementados; browser-second ausente. |
| 10 | PASS | Resolver WEB/DESKTOP/MOBILE testado, explicações ligadas ao Research. |
| 11 | FAIL | Composer cria/versiona/linta com autorização; comparação/exportação sem UI. |
| 12 | FAIL | Registro/licenças no core; sem fluxo real de transformação na UI. |
| 13 | FAIL | Tema/densidade/layout persistentes; atalhos não personalizáveis/persistentes. |
| 14 | FAIL | PreviewAdapter sem IPC/UI e dependência Vite não incluída como runtime de pacote. |
| 15 | FAIL | Recovery testado; executor/testes/evidências de qualidade ausentes da UI. |

Conclusão: integração corrigida e buildável, **não RC1 V1 aprovada**. Lacunas internas não são atribuídas ao Windows. Gate externo impede validar desktop/packaging; sua aprovação, por si só, não corrige as lacunas internas.
