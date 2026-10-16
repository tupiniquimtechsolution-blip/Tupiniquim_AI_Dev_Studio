# ADR 0017 — Web Free: Edge Control Plane + Tupiniquim Remote Runtime

Status: PROPOSTA IMPLEMENTADA  
Data: 2026-09-28

## Contexto

O Web Full utilizava Cloudflare Containers/Sandbox como executor de filesystem, Git, terminal, builds e testes. O deploy real comprovou que essa dependência exige entitlement/plano incompatível com a decisão de manter o produto sem gasto recorrente obrigatório.

Ao mesmo tempo, Workers AI continua oferecendo franquia gratuita e modelos compatíveis com Workers Free. O modelo padrão anterior `@cf/moonshotai/kimi-k2.6` passou a exigir Workers Paid.

## Decisão

A edição Web passa a ser dividida em duas camadas:

1. **Cloudflare Edge Control Plane (Free)**
   - assets/UI;
   - Worker;
   - Workers AI;
   - Durable Objects;
   - autenticação quando configurada;
   - sessão, planejamento e estado lógico.

2. **Tupiniquim Remote Runtime (hardware do usuário)**
   - workspace real;
   - filesystem;
   - Git;
   - terminal/ConPTY ou PTY;
   - pnpm/npm;
   - build/test;
   - persistência local;
   - futuros runtimes locais como Ollama.

O Edge acessa o runtime por HTTPS/WebSocket através de um endpoint configurado, preferencialmente Cloudflare Tunnel.

## Modelo padrão Free

O default Web passa a ser:

`@cf/zai-org/glm-4.7-flash`

O catálogo não deve selecionar silenciosamente modelos que exigem Workers Paid.

## Fail-closed

- `WEB_REMOTE_RUNTIME_ENABLED=false` é o default de deploy.
- Quando o gateway está offline, Chat/Workers AI/estado cloud continuam disponíveis.
- Workspace executável, Git, terminal, build e testes retornam indisponibilidade explícita.
- Nenhum comando remoto é aceito diretamente do browser.
- O gateway exige token forte e limita operações a métodos allowlisted.
- Paths são confinados ao workspace.
- Gates recebem IDs allowlisted; não existe endpoint de shell HTTP arbitrário.

## Migração

A classe `Sandbox` permanece exportada apenas para compatibilidade com a migração histórica do Durable Object. O binding de Sandbox e a configuração `containers` são removidos do `wrangler.jsonc`.

Isso elimina a consulta Cloudflare `/containers/me` durante o deploy.

## Persistência

Enquanto o Remote Runtime está conectado, o workspace é persistido no storage local configurado pelo gateway. Backup R2 pode permanecer como extensão gratuita opcional, não como requisito para o primeiro deploy Free.

## Evidência requerida

1. Cloud Quality GREEN;
2. deploy Cloudflare sem Containers;
3. `/api/health` => `runtime=cloudflare-edge`;
4. Workers AI Free responde com GLM-4.7-Flash;
5. chat + sessão/reload PASS sem Remote Runtime;
6. quando gateway configurado: workspace/Git/terminal/gates PASS;
7. nenhuma capacidade offline recebe PASS fictício.
