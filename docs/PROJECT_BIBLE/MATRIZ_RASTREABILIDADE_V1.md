# Matriz de Rastreabilidade V1

Atualizado em: 2026-09-22

Objetivo: impedir que requisito, implementação, teste e evidência se desconectem. `PASS` abaixo só deve ser preenchido após evidência do HEAD final; o estado inicial reflete a RC1 auditada.

| RF | Capacidade | Estado RC1 | Evidência necessária para aceite | Agenor |
|---|---|---|---|---:|
| RF-01 | Workspace autorizado | Parcial/forte | abrir/criar workspace, path protection, restart | #18/#31 |
| RF-02 | Files create/search/read/edit/atomic/diff | FAIL parcial | criação + busca + edição/diff/salvar no desktop | #19 |
| RF-03 | PTY multissessão/cancel/timeout | FAIL | ConPTY real, approvals, multissessão, timeout | #20/#31 |
| RF-04 | Git status/diff/commit/checkpoint/restore | FAIL parcial | commit/checkpoint/restore seguro + audit | #21 |
| RF-05 | AIProvider Codex/Ollama | FAIL de homologação | Codex real + Ollama inferência real + fail-closed | #22/#31 |
| RF-06 | 8 modos | FAIL parcial | cada modo com efeito/resultado real e testes | #23 |
| RF-07 | Persistência operacional | Parcial | planos/steps/executions/approvals/events/tests/audit integrados | #24 |
| RF-08 | 4 perfis de autonomia | FAIL UI/runtime | seletor, persistência e policy tests | #25 |
| RF-09 | HTTP-first + browser-second | FAIL parcial | browser-second + fontes/confiança/provenance | #26 |
| RF-10 | Technology Resolver | PASS core | smoke WEB/DESKTOP/MOBILE e explicação | #18 |
| RF-11 | Prompt Architect completo | FAIL parcial | create/version/compare/lint/compile/export UI | #27 |
| RF-12 | Visual Lab + licenças | FAIL parcial | asset register/transform/provenance/licença | #28 |
| RF-13 | Tema/densidade/atalhos/layout | FAIL parcial | atalhos editáveis/persistentes + restart | #29 |
| RF-14 | Preview isolado | FAIL | IPC/UI/runtime empacotado + viewport | #30 |
| RF-15 | Test/evidence/recovery | FAIL parcial | executor integrado + evidence pack + recovery | #24/#31 |

## Não funcionais

RNF-01 F:\CODEX-only controlável → verificar em setup/package/evidence.  
RNF-02 renderer sem Node/sandbox/CSP/IPC allowlist → security suite + review.  
RNF-03 privileged ops com schema/policy/cancel/audit → integration/security/dogfood.  
RNF-04 secrets fora de DB/log/prompt/Git → security/redaction/manual review.  
RNF-05 offline quando aplicável → smoke sem rede para local features.  
RNF-06 falha externa clara/recuperável → provider/network failure tests.  
RNF-07 WCAG AA/keyboard/reduced motion → accessibility review.  
RNF-08 DB migrations transacionais + backup → migration/recovery evidence.  
RNF-09 asset direitos desconhecidos bloqueado → Visual Lab tests.

## Gate de fechamento

RF-01..15 e RNF aplicáveis precisam de evidência no HEAD final. Nenhum item pode ser convertido para PASS por inferência ou por existência de código não exercitado.
