# ADR 0014 — Provider, Runtime e Model Compatibility por plataforma

Status: PROPOSTA IMPLEMENTADA NO PR #52  
Data: 2026-09-28

## Contexto

A edição Web Full passou a executar inferência por Cloudflare Workers AI, enquanto Desktop/Windows continua usando runtimes locais como Codex App Server e Ollama. O primeiro bridge Web reutilizou o contrato de Ollama para transportar Workers AI, o que fazia a UI, sessão, provenance e regras de readiness anunciarem um runtime cloud como se fosse Ollama local.

Isso contradiz o invariante canônico:

`Agent != Model != Provider != Tool != Skill != Source Repository`

e também impede a evolução correta para Web, Windows, Mobile e Portable com catálogos diferentes de modelos executáveis.

## Decisão

Separar explicitamente:

- **Provider**: origem/serviço lógico de inferência, por exemplo `codex-app-server`, `ollama`, `cloudflare-workers-ai`;
- **Runtime**: mecanismo executor disponível no dispositivo/edição, por exemplo `codex-app-server`, `ollama`, `workers-ai`;
- **Model**: identificador do modelo reproduzível naquele provider/runtime.

A UI só deve mostrar providers e modelos executáveis no runtime corrente.

### Web

- provider: `cloudflare-workers-ai`;
- runtime: `workers-ai`;
- catálogo inicial allowlisted em `apps/web-runtime/src/model-catalog.ts`;
- um único modelo `default=true` garante startup funcional;
- seleção explícita de outro modelo compatível continua permitida;
- header/client não pode liberar modelo fora da allowlist;
- Workers AI nunca deve ser persistido ou exibido como Ollama.

### Desktop/Windows

- providers atualmente executáveis: `codex-app-server` e `ollama`;
- `cloudflare-workers-ai` é rejeitado no main process local;
- Ollama continua exigindo modelo instalado/selecionado;
- Codex continua com modelo administrado pelo app-server quando aplicável.

### Mobile / futuras superfícies

A mesma regra se aplica: o catálogo deve ser resolvido por disponibilidade real de runtime, entitlement, credenciais, hardware/capabilities e política da edição. Ausência deve resultar em indisponibilidade explícita, nunca em provider/modelo fictício.

## Modelo padrão versus fallback

Modelo padrão inicial compatível **não é fallback automático**.

- O sistema pode iniciar uma edição com um modelo padrão declarado e disponível.
- Se o usuário escolher outro modelo e ele deixar de ser executável, a sessão deve falhar explicitamente/solicitar nova escolha.
- O runtime não troca silenciosamente provider ou modelo durante uma sessão.

## Segurança

- catálogo server-side é autoritativo para modelos Web;
- input do renderer não concede runtime authority;
- ações privilegiadas continuam em Policy/Approval/Audit;
- Sandbox/Containers não são removidos por esta decisão;
- nenhum secret/credential é incorporado ao catálogo.

## Evidência

PR #52 implementa o primeiro slice:
- Workers AI provider real;
- metadata provider/runtime/model;
- filtragem por plataforma;
- modelo Web padrão;
- allowlist server-side;
- bootstrap automático do workspace Web;
- testes unitários de catálogo/compatibilidade.

A promoção depende de gates automatizados e smoke funcional do deployment real.
