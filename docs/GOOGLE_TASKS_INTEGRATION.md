# Google Tasks — integração do Tupiniquim AI Dev Studio

## Objetivo

Adicionar Google Tasks como camada operacional de tarefas do Tupiniquim sem expor senha Google, access token ou refresh token ao renderer, ao Git ou aos agentes.

Esta integração usa a Google Tasks API v1 e OAuth 2.0 para aplicativo de computador com PKCE e callback loopback em `127.0.0.1`.

## Escopo OAuth

Para o fluxo completo de leitura e mutação de tarefas, solicitar somente:

```text
https://www.googleapis.com/auth/tasks
```

Não solicitar Drive, Gmail, Calendar ou escopos de perfil Google para esta integração.

## Configuração do Google Cloud

1. Criar ou selecionar um projeto no Google Cloud Console.
2. Habilitar **Google Tasks API**.
3. Configurar a tela de consentimento OAuth.
4. Criar um OAuth Client ID do tipo **Desktop app**.
5. Copiar o Client ID e, quando fornecido pelo Google, o Client Secret para `.env.local`:

```dotenv
GOOGLE_TASKS_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
GOOGLE_TASKS_CLIENT_SECRET=SEU_CLIENT_SECRET
```

Nunca preencher valores reais em `.env.example` e nunca versionar `.env.local`.

## Fluxo de autorização planejado para o desktop

```text
Renderer
   |
   | ação humana "Conectar Google Tasks"
   v
Electron main process
   |
   | cria state + PKCE
   | inicia listener 127.0.0.1:<porta aleatória>
   | abre navegador do sistema
   v
accounts.google.com
   |
   | consentimento do usuário
   v
127.0.0.1:<porta>/oauth/callback
   |
   | valida state
   | troca code + code_verifier por tokens
   v
Electron safeStorage
   |
   | token cifrado no armazenamento local
   v
Google Tasks API
```

O renderer recebe somente status e dados de tarefas; nunca recebe tokens OAuth.

## API implementada nesta branch

`GoogleTasksOAuthClient`:

- cria sessão OAuth com `state` e PKCE S256;
- troca authorization code por access/refresh token;
- renova access token;
- revoga token;
- não incorpora credenciais em mensagens de erro HTTP.

`GoogleTasksApiClient`:

- lista listas de tarefas com paginação;
- lista tarefas com paginação;
- cria tarefa;
- atualiza tarefa;
- conclui tarefa;
- exclui tarefa.

Os contratos públicos ficam em `packages/contracts/src/google-tasks.ts`.

## Modelo de organização recomendado

Criar uma lista Google Tasks por frente de trabalho, sem criar listas automaticamente até haver confirmação humana:

- Tupiniquim AI Dev Studio
- CRM Tupiniquim
- GlicoControl-MVP
- Top Tech BR
- Vanessa Braz
- MetalArt
- AI-LAB
- Geral

O nome é configuração do usuário, não regra de domínio hard-coded.

## Regras de segurança

1. `GOOGLE_TASKS_CLIENT_ID` e `GOOGLE_TASKS_CLIENT_SECRET` pertencem somente a `.env.local`.
2. Access/refresh tokens não devem ser gravados em logs, AuditLog, SQLite de domínio, Flight Recorder ou mensagens de agente.
3. O renderer não pode receber access/refresh token.
4. O callback OAuth deve aceitar apenas loopback `127.0.0.1` em porta efêmera e validar `state` antes da troca do authorization code.
5. Para persistência, usar `safeStorage` do Electron. Se criptografia segura não estiver disponível, não persistir refresh token em texto claro.
6. Operações mutáveis (`create`, `update`, `complete`, `delete`) devem passar pela semântica de aprovação humana já usada pelo perfil `ASSISTED`; não reduzir a política global apenas para facilitar a integração.
7. URLs da API são hard-coded para domínios Google oficiais; não aceitar base URL arbitrária vinda do renderer.
8. Ao desconectar, revogar o token quando possível e apagar o token local cifrado.

## Gate para integração no desktop

Antes de ligar os novos adapters aos canais IPC:

- implementar armazenamento cifrado com Electron `safeStorage`;
- implementar callback loopback com timeout e validação de `state`;
- definir canais IPC tipados de `status`, `connect`, `disconnect`, `listTaskLists`, `listTasks`, `create`, `update`, `complete` e `delete`;
- garantir que mutações recebam confirmação privilegiada no main process ou usem o fluxo `PlanApprovalService`;
- adicionar testes de segurança provando que tokens não atravessam IPC/auditoria;
- adicionar UI de conexão e painel de tarefas sem expor credenciais.

Não fazer bypass do `PolicyEngine` para concluir este gate.

## Referências oficiais

- Google Tasks API authorization: https://developers.google.com/workspace/tasks/auth
- OAuth 2.0 for Desktop Apps: https://developers.google.com/identity/protocols/oauth2/native-app
- Tasks API v1 reference: https://developers.google.com/workspace/tasks/reference/rest
