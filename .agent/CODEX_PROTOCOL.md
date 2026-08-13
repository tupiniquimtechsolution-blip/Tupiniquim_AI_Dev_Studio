# Codex App Server — Manifesto de Protocolo

- Codex CLI: `0.147.0-alpha.6.5`
- Transporte: stdio JSONL estável
- API experimental: desabilitada
- Schemas gerados em: `packages/contracts/schemas/codex-app-server/`
- Comandos de geração:

```powershell
codex app-server generate-ts --out <diretório-transitório-em-F-CODEX>
codex app-server generate-json-schema --out .\packages\contracts\schemas\codex-app-server
```

Os tipos transitórios foram inspecionados e preservados fora do Git em `F:\CODEX\Tupiniquim-AI-Dev-Studio.data\generated-transient`. O adapter mantém apenas tipos validados e necessários à superfície usada. `thread/shellCommand`, WebSocket e campos experimentais são proibidos pelo ADR 0005.

`account/login/start` recebe a chave somente no processo main. A configuração `cli_auth_credentials_store="keyring"` força qualquer cache de autenticação para o cofre protegido do Windows; o segredo nunca cruza IPC, logs ou banco do produto.
