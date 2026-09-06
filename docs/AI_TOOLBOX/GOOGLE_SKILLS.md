# Google Skills — fonte oficial de skills do ecossistema Google

Atualizado em 2026-09-04.

Fonte oficial: `google/skills`.

## Classificação no Tupiniquim

`google/skills` é uma **First-Party Skill Source** para produtos e tecnologias Google.

Isso significa:

- tem prioridade de consulta sobre skills comunitárias equivalentes quando a tarefa é especificamente Google;
- continua subordinado ao Skill Gate da Tupiniquim;
- não é carregado globalmente em todas as tarefas;
- não recebe autoridade para executar shell, rede, credenciais, cloud ou mudanças de infraestrutura sem PolicyEngine/ApprovalStore/AuditLog;
- não altera a regra `Agent != Model != Provider != Tool != Skill != Source Repository`;
- não cria preferência automática por Gemini como modelo do Tupiniquim.

O repositório declara licença Apache-2.0 e está sob desenvolvimento ativo.

## Estratégia de carga

Para tarefas Google, o Tupiniquim deve preferir o roteador oficial:

`google/skills:skills/developers/finding-google-skills`

O Skill Finder do Google foi projetado para consultar o catálogo e carregar somente as skills relevantes, evitando pré-carregar o repositório inteiro.

Fluxo Tupiniquim:

`pedido Google -> Google Skill Finder -> shortlist de até 3 skills -> Skill Gate -> loadout da tarefa -> execução controlada`

Não manter o catálogo remoto como verdade permanente. O índice muda com o tempo; snapshots locais podem servir para auditoria/provenance, mas a resolução operacional deve revalidar a fonte atual quando houver acesso de rede aprovado.

## Skills prioritárias para nossa arquitetura

### Gemini / AI

- `skills/cloud/gemini-api` — Gemini API em Agent Platform, multimodal, function calling, structured output, embeddings, media generation e Live API.
- `skills/cloud/gemini-live-api` — streaming bidirecional em tempo real para texto/áudio/vídeo, útil para a futura camada de voz do Tupiniquim.
- `skills/cloud/agent-platform-model-registry` — referência oficial para gestão de modelos no ecossistema Google.
- `skills/cloud/agent-platform-skill-registry` — referência oficial para Skill Registry.
- `skills/cloud/google-cloud-solution-build-deploy-agents` — padrões para construção/deploy de agentes no Google Cloud.
- `skills/cloud/google-cloud-solution-multi-agent-security` — padrões oficiais de segurança para arquiteturas multiagente.

### Tooling / conhecimento

- `skills/developers/finding-google-skills` — roteador oficial para descobrir skills Google sob demanda.
- `skills/developers/retrieving-developer-knowledge` — consulta a conhecimento/documentação oficial de desenvolvedor Google.
- `skills/cloud/gcloud` — referência para uso do gcloud por agentes; qualquer execução real continua sujeita a approval/policy.

### Google Ads

- `skills/ads/google-ads-api-mcp-setup` — referência oficial para integrar o Google Ads MCP Server.
- `skills/ads/google-ads-api-quickstart` — configuração inicial da API.
- `skills/ads/google-ads-api-account-diagnostics` — diagnósticos de conta/campanha.

Isso é particularmente relevante para os projetos comerciais da Tupiniquim, mas credenciais, Developer Token, OAuth, contas e ações externas nunca são ativados automaticamente.

## Relação com o Multi-LLM

O repositório também oferece instalação para múltiplos harnesses, incluindo Codex e Claude Code, além do padrão Agent Skills. No Tupiniquim, isso será tratado como uma fonte de skills reutilizável, não como um acoplamento de runtime.

Exemplo:

`AGENT-RESEARCH -> skill Google apropriada -> modelo escolhido pelo usuário`

ou

`AGENT-VOICE -> gemini-live-api (quando aprovado) -> Gemini provider`

A skill pode exigir uma capacidade Google, mas o agente continua separado do modelo/provider.

## Relação com as Waves

### Wave 1

Nenhuma mudança de runtime. Apenas registro documental. A Wave 14 continua focada em tool-protocol provenance + Browser QA.

### Wave 2

- integrar `google/skills` como First-Party Skill Source;
- adicionar metadata/index ao Skill Registry;
- usar `finding-google-skills` como roteador condicional;
- classificar skills por capabilities, permissões, custo, rede e credenciais;
- registrar provenance/ref/hash;
- integrar Google Ads MCP como candidato do MCP Registry, sem credenciais automáticas.

### Wave 4

Agent loadouts podem selecionar skills Google conforme função/projeto, sem fixar Gemini ou Google Cloud como provider padrão.

### Wave 5

- Gemini API/MediaProvider;
- Gemini Live API para voz/multimodal em tempo real;
- Google-specific media/agent capabilities quando aprovadas.

## Segurança

Skills oficiais são fonte de primeira parte, mas suas instruções ainda podem pedir:

- shell;
- rede;
- `gcloud`;
- instalação de pacotes;
- credenciais;
- OAuth;
- alteração de infraestrutura;
- chamadas a APIs externas.

Portanto, a origem oficial reduz risco de supply-chain e desatualização, mas **não substitui**:

- Skill Gate;
- PolicyEngine;
- ApprovalStore;
- AuditLog;
- redaction;
- project isolation;
- least privilege.

Nenhuma chave, token, cookie, refresh token, service-account JSON ou `.env*` pode ser versionado.

## Backup

O repositório deve ser incluído no backup bruto da AI Toolbox como:

`google__skills`

O backup é referência/auditoria; não significa ativação automática de todas as skills.
