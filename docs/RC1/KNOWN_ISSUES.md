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
