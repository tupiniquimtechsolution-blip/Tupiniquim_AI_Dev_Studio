# MW3 Readiness Matrix

Esta matriz separa evidência cloud de certificação Windows. `CLOUD_PASS` nunca significa `RELEASE_GREEN`.

## Funcionais

| Check | Estado MW3 cloud | Evidência / limite |
|---|---|---|
| RF-01 workspace autorizado | CLOUD_PASS | integração/workspace existente + path boundary dogfood A |
| RF-02 arquivos/diff/path safety | CLOUD_PASS | integration/security + dogfood A |
| RF-03 PTY real/múltiplas sessões | WINDOWS_DEFERRED | ConPTY/processo Electron requer host Windows real |
| RF-04 Git seguro/checkpoints | CLOUD_PASS | integrações Git temporárias; comportamento Windows final continua release gate |
| RF-05 AIProvider/Codex protocol | CLOUD_PASS | contratos + app-server fake/JSONL; autenticação/provider live é externa e não é simulada |
| RF-06 modos CHAT/PLAN/RESEARCH/EXECUTE/REVIEW/DEBUG/PROMPT/VISUAL | CLOUD_PASS para contratos/core já versionados | UI/hardware específico não é promovido por esta matriz |
| RF-07 persistência de domínio/auditoria | CLOUD_PASS | integration SQLite/persistência/audit existentes |
| RF-08 SAFE/ASSISTED/AUTONOMOUS/FULL_ACCESS | CLOUD_PASS | PolicyEngine + security dogfood B; bloqueios absolutos preservados |
| RF-09 pesquisa com fontes/confiança | CLOUD_PASS | Research network security + MW2 ResearchAgent + dogfood C |
| RF-10 Technology Resolution | CLOUD_PASS | core + dogfood D |
| RF-11 Prompt Architect | CLOUD_PASS | core + dogfood E |
| RF-12 Visual Intelligence/licença | CLOUD_PASS para gate de licença | dogfood F; APIs externas reais continuam dependentes de credencial |
| RF-13 tema/densidade/layout | CLOUD_PASS para PreferenceService/WCAG | dogfood G |
| RF-14 preview isolado/viewport | CLOUD_PASS para contracts/path/redaction; WINDOWS_DEFERRED para Electron visual | dogfood I + preview adapter; browser/Electron real segue certificação |
| RF-15 testes/evidência/recovery | CLOUD_PASS | Cloud Quality Gate + readiness gate K + suites existentes |

## Não funcionais

| Check | Estado MW3 cloud | Evidência / limite |
|---|---|---|
| RNF-01 raiz operacional | CLOUD_PASS no runner / WINDOWS_DEFERRED para `F:\CODEX` | cloud usa workspace efêmero controlado; Windows mantém contrato F: |
| RNF-02 renderer sandbox/CSP/IPC | WINDOWS_DEFERRED para certificação Electron; contratos/security permanecem cloud-testados | não simular renderer real |
| RNF-03 schema/policy/cancelamento/auditoria | CLOUD_PASS para core/protocolo | security + suites existentes |
| RNF-04 secrets nunca persistem | CLOUD_PASS | Knowledge quarantine + redaction hardening + security MW3 |
| RNF-05 offline por padrão | CLOUD_PASS por arquitetura | rede explícita isolada; providers externos não presumidos |
| RNF-06 falha externa clara/recuperável | CLOUD_PASS para contracts/core | suites de provider/recovery existentes |
| RNF-07 WCAG/teclado/reduced motion | CLOUD_PASS para contraste; Electron UI completa WINDOWS_DEFERRED | dogfood G + E2E final físico |
| RNF-08 migrações transacionais/backup | NOT_APPLICABLE à MW3 | nenhum DDL Supabase é aplicado nesta wave |
| RNF-09 licença de assets | CLOUD_PASS | dogfood F bloqueia licença desconhecida |

## Regra de promoção

- `CLOUD-GREEN`: nenhum check cloud aplicável está `BLOCKED` e o CI canônico passa.
- `RELEASE-GREEN`: adicionalmente não pode haver requisito obrigatório `WINDOWS_DEFERRED`.
- Qualquer divergência descoberta no Prompt Mestre original A–K deve gerar issue de reconciliação; não altera silenciosamente a evidência desta wave.