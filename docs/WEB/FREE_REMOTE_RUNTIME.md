# Web Free — Tupiniquim Remote Runtime

Status: IMPLEMENTADO / CLOUD-ONLY GREEN / REMOTE RUNTIME RELEASE GATE PENDENTE  
Data: 2026-09-30

## Objetivo

Executar a edição Web sem Cloudflare Containers e sem mensalidade obrigatória.

## Arquitetura

Browser → Cloudflare Worker/Assets/Workers AI → HTTPS/WebSocket → Cloudflare Tunnel → Tupiniquim Runtime Gateway local.

O Worker continua responsável pelo control plane. O gateway local é responsável apenas pelas capacidades que exigem sistema operacional real.

## Primeiro deploy Free

`wrangler.jsonc` usa:

- Workers AI;
- Assets;
- Durable Object `STATE`;
- `WEB_REMOTE_RUNTIME_ENABLED=false`;
- `WEB_WORKSPACE_BACKUP_ENABLED=true` prepara checkpoints locais, mas eles só recebem PASS quando o gateway estiver READY.

Não existe bloco `containers`.

Nesse estado:
- UI: disponível;
- Workers AI: disponível dentro da franquia Free;
- Chat: disponível;
- sessão/reload: disponível;
- planejamento/estado: disponível;
- filesystem/Git/terminal/build/test: explicitamente offline.

## Modelo padrão

`@cf/zai-org/glm-4.7-flash`

## Iniciar gateway local

Defina no Windows/host local:

```powershell
$env:TUPINIQUIM_GATEWAY_TOKEN="<token-aleatorio-forte>"
$env:TUPINIQUIM_GATEWAY_ROOT="F:\\TupiniquimRuntime"
pnpm runtime:gateway
```

Default:
- host: `127.0.0.1`;
- porta: `43721`.

O gateway não deve ser exposto diretamente por port-forwarding.

## Publicar por Tunnel

Use Cloudflare Tunnel apontando o hostname do runtime para:

`http://127.0.0.1:43721`

No Worker configure:
- `WEB_REMOTE_RUNTIME_ENABLED=true`;
- `REMOTE_RUNTIME_URL=https://<hostname-do-runtime>`;
- secret `REMOTE_RUNTIME_TOKEN` igual ao token local;
- `WEB_WORKSPACE_BACKUP_ENABLED=true` para checkpoint/restore local.

R2 não é requisito para essa persistência. A referência canônica é `docs/WEB/WORKSPACE_LOCAL_PERSISTENCE.md`.

## Segurança

O gateway:
- exige Bearer token;
- faz comparação timing-safe;
- cria um workspace por ID;
- rejeita traversal;
- não possui endpoint HTTP de shell arbitrário;
- permite somente RPCs implementados;
- executa gates por allowlist;
- terminal usa WebSocket autenticado;
- bind local default é `127.0.0.1`.

## Capacidades RPC

- filesystem exists/mkdir/read/write;
- tree/search;
- Git status/diff;
- bootstrap de repositório GitHub;
- backups locais;
- gates allowlisted;
- terminal PTY.

## Health

O Web expõe `executionRuntime`:

- `DISABLED`: gateway não habilitado;
- `MISCONFIGURED`: habilitado sem URL/token;
- `OFFLINE`: configurado, mas inacessível;
- `READY`: gateway autenticado respondeu ao health.

Nenhuma dessas transições é convertida em PASS automaticamente.
