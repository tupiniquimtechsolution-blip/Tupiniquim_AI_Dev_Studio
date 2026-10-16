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

## Iniciar gateway local no Windows

O bootstrap canônico não imprime o token e o persiste protegido por DPAPI no perfil do usuário:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-remote-runtime-gateway.ps1
```

Saída esperada:

- `TUPINIQUIM_RUNTIME_GATEWAY_READY`;
- `LOCAL_URL=http://127.0.0.1:43721`;
- platform `win32`;
- capabilities incluindo `local-persistence`;
- `TOKEN=PROTECTED_DPAPI_NOT_PRINTED`.

Default:
- host: `127.0.0.1`;
- porta: `43721`.

O gateway não deve ser exposto diretamente por port-forwarding.
## Publicar por Tunnel

Para certificação de produção use um **named Cloudflare Tunnel** com hostname DNS estável da conta. Quick Tunnel é somente para desenvolvimento/teste.

Depois de autenticar o `cloudflared`, execute:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-remote-runtime-tunnel.ps1 -Hostname "runtime.seu-dominio.example" -ConfigureWorkerSecret
```

O script:
- reutiliza/cria `tupiniquim-runtime`;
- cria a rota DNS para o Tunnel;
- publica somente `http://127.0.0.1:43721`;
- valida `/health` autenticado via HTTPS;
- opcionalmente grava `REMOTE_RUNTIME_TOKEN` no Worker via Wrangler sem imprimir o valor;
- nunca grava o token em Git.

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
