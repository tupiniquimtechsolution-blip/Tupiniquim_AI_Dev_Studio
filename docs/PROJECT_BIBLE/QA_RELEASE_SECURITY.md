# QA, Release e Segurança

Atualizado em: 2026-09-22

## 1. Filosofia de qualidade

O projeto não considera `build` equivalente a produto homologado. Cada release candidata deve provar comportamento em três camadas: testes automatizados, ambiente alvo real e dogfood humano.

## 2. Gates automatizados mínimos

- lint
- typecheck
- unit
- integration
- security
- build
- Electron E2E
- testes direcionados de regressão para todo bug corrigido

Nenhum `SKIPPED` pode ser apresentado como `PASS`. Gates específicos de Windows devem rodar no Windows F: ou permanecer `REQUIRES_WINDOWS_GATE`.

## 3. Smoke funcional V1

Cobertura manual obrigatória:

1. abrir/criar workspace autorizado;
2. ler/criar/buscar/editar/salvar arquivo e observar diff;
3. terminal real: abrir, escrever, cancelar, timeout e múltiplas sessões;
4. Git: status/diff/commit/checkpoint/restore seguro;
5. Codex: AUTH_REQUIRED/READY e turn real sem loop de reconnect;
6. Ollama: listar modelos reais, selecionar manualmente e inferir;
7. modos CHAT/PLAN/RESEARCH/EXECUTE/REVIEW/DEBUG/PROMPT/VISUAL;
8. aprovação/rejeição e proposal EXPIRED;
9. restart/recovery e continuidade session/thread;
10. isolamento workspace A → B → A;
11. research com fontes/provenance/confiança;
12. Prompt Architect;
13. Visual Lab/licenças;
14. preferences/atalhos/layout;
15. preview isolado;
16. Test Runner/evidence;
17. Google Tasks NOT_CONFIGURED e OAuth real quando configurado.

## 4. Classificação de finding

- CRITICAL: risco de perda/corrupção de dados, exposição de segredo, execução indevida, bypass de política ou app inutilizável.
- HIGH: fluxo V1 essencial quebrado, regressão grave, auth/session/provider incorretos.
- MEDIUM: funcionalidade parcial com workaround, UX relevante, observabilidade/documentação incompleta.
- LOW: polish, mensagens, refinamentos sem risco funcional.

Categorias técnicas: `PRODUCTION BUG`, `E2E/HARNESS BUG`, `UX BUG`, `SECURITY`, `DOCUMENTATION GAP`, `ENVIRONMENT`, `OUT OF SCOPE`.

## 5. Release flow

1. HEAD/branch/worktree registrados.
2. `validate` completo.
3. E2E completo no ambiente alvo.
4. dogfood manual do escopo.
5. bugs classificados.
6. correções mínimas + regressão específica.
7. reexecutar toda a suíte no novo HEAD.
8. review externo do diff.
9. atualizar STATUS/TEST_RESULTS/CHANGELOG/KNOWN_ISSUES/HANDOFF/Project Bible/Agenor.
10. somente então merge/checkpoint/tag conforme plano.

## 6. Segurança arquitetural

- renderer sem Node privilegiado;
- sandbox e CSP restritiva;
- IPC allowlisted e tipado;
- schema/PolicyEngine/ApprovalStore/AuditLog em efeitos mutáveis;
- segredos nunca em Git, logs, prompts, DB ou mensagens de erro;
- CODEX_HOME isolado; nunca copiar credenciais do perfil normal;
- Google OAuth com PKCE/loopback e token fora do renderer;
- nenhuma seleção silenciosa de provider/modelo;
- nenhuma automação paga/credencial externa sem aprovação explícita;
- external repos/skills/MCPs são fontes não confiáveis até gate de adoção;
- filesystem limitado ao workspace/roots autorizados;
- comandos/processos submetidos a policy, cancelamento e audit.

## 7. Backup/recovery

Migrações SQLite devem ser transacionais e precedidas por backup. Sessões e escolhas persistidas não podem restaurar autoridade antiga de approvals/proposals. Configuração corrompida deve falhar explicitamente, nunca escolher provider/modelo alternativo silenciosamente.

## 8. Definition of Release Candidate

Uma RC pode existir com known issues documentados, mas não é V1 aprovada enquanto qualquer RF obrigatório estiver `FAIL`, houver blocker crítico/alto, pacote Windows não estiver homologado ou providers reais não tiverem evidência adequada.

## 9. Evidence pack

Cada gate final deve produzir, quando aplicável: HEAD, branch, timestamp, ambiente, versões runtime, resultados de suíte, screenshots/logs sanitizados, modelos/providers usados, IDs de session/thread sem conteúdo privado, artefato de package e hash quando possível.

## 10. Reteste dirigido dos blockers RC1 — Windows 20260922-173713

Evidence pack informado pelo operador: `F:\CODEX\Tupiniquim-AI-Dev-Studio.data\rc1-evidence\20260922-173713`, HEAD `48637999ac05f3f2d10c61b9bba46aefad8d5421`. Segundo o relato Windows: validate:f-drive/lint/typecheck/unit/integration/security/build PASS; E2E/package/ollama-live FAIL. O pack F: não é diretamente acessível no Arena Linux.

Correções: barreira terminal antes da inspeção de sessão; helpers de troca confirmam identidade + READY (e modelo Ollama), inclusive via IPC; smoke required determinístico e logs sanitizados; preflight MSVC/Spectre fail-closed antes de package:win. Sem alteração do comportamento de produção para satisfazer E2E, sem aumento de timeout, sem remoção de node-pty/rebuild/gates. Detalhes de remediação manual e limites em `docs/RC1/KNOWN_ISSUES.md`.

Spectre/VC\v180 continua pré-requisito externo: **REQUIRES_WINDOWS_ENV_FIX**. A inspeção de arquivos do preflight é apenas pré-condição, nunca substitui `@electron/rebuild` e packaging completos. Não foi provado o component ID oficial exato da instância observada; não inventar nem instalar automaticamente.

Arena nesta correção: lint/typecheck/build PASS; unit 218 PASS; integration 102 PASS / 4 SKIPPED; security 38 PASS. Os cinco E2E permanecem não executáveis neste Linux e seus skips não são aceitos como validação. A chamada package:win retorna exit 1 com **REQUIRES_WINDOWS_GATE**, como esperado para este ambiente. Os testes PowerShell de smoke devem ser executados no Windows PowerShell real; nenhuma afirmação de Windows GREEN.
