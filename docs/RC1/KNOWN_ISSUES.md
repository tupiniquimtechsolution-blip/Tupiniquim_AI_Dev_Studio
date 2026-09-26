# RC1 — pendências verificadas (não é aceite V1)

A integração compila, mas **não cumpre ainda a Definition of Done**. Não declarar release aprovada.

## Bloqueios externos
- REQUIRES_WINDOWS_GATE: Arena Linux não possui Windows, F:, PowerShell/ConPTY ou desktop Windows. Cinco E2E são Windows-only, não PASS.
- Download do binário Electron no Arena falhou (`fetch failed`). Nenhum executável Windows foi produzido/testado aqui.
- Codex autenticado, inferência Ollama real e OAuth Google com conta humana não foram executados. Não há cópia de credenciais nem login automático.

## Lacunas funcionais encontradas no código herdado
- RF-02: leitura/edição/salvar e diff ligados; criação de arquivo e busca não possuem formulário completo no renderer.
- RF-03: ConPTY existe, mas `terminal.write` continua exigindo aprovação sem fluxo privilegiado utilizável. A falha agora aparece no terminal, não é silenciosa. UI de múltiplas sessões e timeout ainda ausentes.
- RF-04: Git adapter implementa status/diff apenas; commit/checkpoint/restauração não implementados.
- RF-06: CHAT/REVIEW/DEBUG enviam turnos; PLAN possui pipeline de proposta Ollama. EXECUTE não é orquestrador completo; VISUAL é diagnóstico de adapters, não transformação. Codex permanece read-only no pipeline PLAN.
- RF-07/RF-15: SQLite persiste planos/executions/approvals/events/sessions; não existe executor de suítes integrado com evidências. Aba Testes desabilitada com motivo.
- RF-08: PolicyEngine tem quatro perfis testados, runtime permanece ASSISTED sem seletor de perfis. Não afrouxado para mascarar bloqueios.
- RF-09: HTTP-first existe, browser-second não integrado. Pesquisa necessita aprovação nativa e disponibilidade da rede pública.
- RF-11: criação/lint/versionamento pelo composer disponíveis com aprovação nativa; comparar/exportar/compilar existem no core/IPC mas ainda sem painel completo.
- RF-12: controle de licença existe; transformações e cadastro de assets não estão ligados a um fluxo visual completo.
- RF-13: tema/densidade/layout persistem; edição/persistência de atalhos não implementadas.
- RF-14: PreviewAdapter existe, mas não está exposto no IPC/renderer; Vite é devDependency, não runtime do pacote. Preview não pode ser declarado funcional.

## Limites operacionais
- Modelo required pequeno não garante tool calling. PLAN exige modelo Ollama que realmente implemente a ferramenta de proposta; não há fallback que invente provenance.
- Setup reaproveita serviço Ollama já ativo. Se modelos antigos estiverem no perfil C:, não move/apaga dados nem muda a loja silenciosamente; orienta iniciar o serviço existente ou migrar manualmente com autorização.
- Novo runtime e modelos criados pelo setup usam F:. Downloads são oficiais; Node tem SHA-256 verificado. Ollama/MinGit usam releases oficiais latest (não reproduzíveis byte-a-byte).
- Configuração corrompida `provider-choice.json` falha explicitamente no startup em vez de escolher outro provider silenciosamente.
- Aprovação nativa nova é one-shot para escrita manual, prompt, research e cadastro visual; agente continua obrigado a usar proposal/hash/approval do pipeline original. Sem autorização de terminal implícita.
- Suíte security contém verificações estáticas de fronteira OAuth/aprovação; não substitui execução do consentimento OAuth no Windows.

## Reteste do evidence pack Windows 20260922-173713 (HEAD auditado 4863799)

Escopo desta correção: exclusivamente os quatro blockers relatados; nenhuma mudança de produção no renderer/providers e nenhuma nova Wave.

- **E2E/HARNESS BUG — sessão:** corrigida a leitura de `agent.session()` após texto recebido por MESSAGE_DELTA mas antes do turno terminal. Agora exige o helper READY, select habilitado e identidade Codex/READY antes de inspecionar thread/model/provenance. Assertions originais preservadas.
- **E2E/HARNESS BUG — Issue #25:** troca raw Ollama → Codex substituída pelos helpers canônicos, incluindo modelo explícito Ollama. Helpers também confirmam provider/READY via IPC, pois até o valor nativo do select pode mudar antes de o handler async concluir. Nenhum sleep, retry cego, timeout inflado ou novo skip.
- **OLLAMA LIVE:** smoke usa exclusivamente o único `tier=required` do manifesto (`qwen2.5-coder:3b`), verifica instalação por nome exato e não usa a ordem de `/api/tags`. Timeout mantido em 180s (cold load + geração); tags 5s. `ollama-live.log` e `results.json` incluem modelo, duração, done, timeout e causa sanitizada por categoria/HTTP status; nunca corpo de erro, resposta gerada ou credenciais. Não muda a seleção do app. Modelo ausente, timeout e resposta incompleta continuam FAIL.
- **ENVIRONMENT / WINDOWS TOOLCHAIN PREREQUISITE — MSB8040:** permanece **REQUIRES_WINDOWS_ENV_FIX** até prova Windows. Evidência relatada: electron-builder 26.15.3 / Electron 43.2.0 / node-pty 1.2.0-beta.14 / Build Tools 18 / MSBuild / VC\v180, exigindo bibliotecas com mitigação Spectre.

### Remediação manual Spectre (sem elevação automática)

No Visual Studio Installer, selecionar a instância Build Tools usada pelo rebuild, **Modificar → Componentes individuais**, instalar as **bibliotecas MSVC x64/x86 com mitigação Spectre correspondentes ao toolset instalado**. Não instalar bibliotecas de outra versão supondo compatibilidade. O component ID exato para a instância VC\v180 observada **não foi comprovado**; não é fornecido um ID especulativo.

`package:win` agora executa `scripts/check-windows-toolchain.ts` antes de build/rebuild: consulta vswhere para a instância MSVC x64/x86 mais recente, exige instalação completa, MSBuild, versão default em `VC/Auxiliary/Build/Microsoft.VCToolsVersion.default.txt`, compilador x64 e `VC/Tools/MSVC/<versão>/lib/spectre/x64/{libcmt,msvcrt}.lib`. Overrides MSVC/Developer Prompt e arquitetura diferente de x64 são recusados para não certificar outro toolset. Execute em PowerShell normal. O preflight **não certifica o rebuild** e não modifica a instalação. node-pty e rebuild nativo permanecem habilitados.

Retestar no Windows: `scripts/verify-rc1-windows.ps1`; inclui os sete cenários offline PowerShell de seleção/diagnóstico Ollama (`test:rc1-windows-scripts`), além de todos os gates anteriores. Exigir os dois E2E passando **sem skips**, Ollama live real e package real após a remediação humana. Não declarar Windows GREEN com resultado Arena.
