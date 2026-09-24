# Cloud-First Operating Model

Atualizado em: 2026-09-24

## Decisão

O Tupiniquim AI Dev Studio passa a operar em desenvolvimento **cloud-first**. GitHub permanece a fonte de verdade. A homologação Windows real deixa de bloquear a evolução funcional e passa a ser um gate final de release.

Esta decisão não transforma Cloudflare em um Windows virtual e não autoriza simular capacidades locais indisponíveis.

## Estados oficiais

- `CLOUD-DEVELOPMENT`: desenvolvimento ativo em branches GitHub com CI, revisão e evidência automatizada.
- `CLOUD-GREEN`: todos os gates cloud obrigatórios da wave passaram no HEAD auditado.
- `WINDOWS-DEFERRED`: capacidades exclusivamente Windows permanecem sem certificação física, mas não bloqueiam a próxima wave cloud.
- `RELEASE-GREEN`: cloud + homologação Windows real + critérios humanos obrigatórios concluídos.

`CLOUD-GREEN` nunca deve ser descrito como `RELEASE-GREEN`.

## Fonte de verdade e superfícies

1. GitHub: código, branches, PRs, Actions, evidências, changelog e checkpoints.
2. GitHub Actions: execução reproduzível de gates cloud e smoke Windows hospedado quando aplicável.
3. Cloudflare Pages/Workers: preview web, control plane e APIs browser-safe. Nenhuma capacidade Electron/ConPTY/Ollama local é fingida.
4. Supabase: backend opcional por projeto/wave, com RLS, isolamento e escopo explícito. Não é dependência global automática.
5. Google Drive: backup/export de evidências e artefatos; não é fonte de verdade de código.
6. Windows F:\CODEX: reservado para certificação final de release e testes que dependam do runtime físico/local.

## Regras de branch

- `main` continua protegida.
- PR #32 e `arena/01a0c8ba-tupiniquim-ai-dev-studio` permanecem como trilha RC1/Windows deferred.
- Desenvolvimento cloud inicia em `cloud/master-wave-2-foundation`, derivada exatamente de `9e9840a38a05d1989effe91134f6329abae507aa`.
- Sem force push.
- Nenhuma mudança cloud deve reescrever evidência histórica da RC1.

## Gates por wave

Cada Master Wave cloud segue:

`PLAN -> IMPLEMENT -> CLOUD CI -> SECURITY -> REVIEW DIFF -> EVIDENCE -> STATUS -> CHECKPOINT`

No mínimo:

- instalação por lockfile;
- lint;
- typecheck;
- unit;
- integration;
- security;
- build;
- validação da integração adicionada na wave;
- artefato de evidência GitHub Actions;
- revisão de diff antes do checkpoint.

Gates específicos de Windows entram na matriz de `WINDOWS-DEFERRED` até a certificação final.

## Política de preview

Cloudflare começa com um control plane/status preview real e não simulado. Capacidades do app só aparecem no browser quando houver implementação browser-safe equivalente e testes próprios.

É proibido apresentar filesystem local, terminal, Git local, ConPTY, Ollama local ou IPC Electron como funcionais no browser se o backend real correspondente não estiver disponível.

## Supabase

Supabase é preparado como integração opcional. Até existir um projeto dedicado e aprovado:

- estado: `NOT_CONFIGURED`;
- nenhuma tabela/migration é criada;
- nenhum projeto existente de outro produto é reutilizado;
- MCP de desenvolvimento deve ser project-scoped e preferencialmente read-only;
- secrets permanecem em GitHub Secrets/Supabase, nunca no Git.

## Cloudflare

Cloudflare é preparado via GitHub Actions. Secrets obrigatórios:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

O primeiro deploy cria/usa o projeto Pages `tupiniquim-ai-dev-studio` e publica `cloud/preview/` como control plane inicial. A emulação funcional do Studio será adicionada progressivamente por wave.

## Certificação Windows final

Antes de qualquer V1/V2 pública ou afirmação `RELEASE-GREEN`, executar novamente no Windows real:

- package Windows;
- Electron E2E real;
- ConPTY;
- providers locais;
- Ollama/modelo requerido quando ainda fizer parte do release;
- persistência/restart;
- OAuth humano quando aplicável;
- smoke manual dos fluxos críticos.

Até lá, esses itens permanecem explicitamente `WINDOWS-DEFERRED`.
