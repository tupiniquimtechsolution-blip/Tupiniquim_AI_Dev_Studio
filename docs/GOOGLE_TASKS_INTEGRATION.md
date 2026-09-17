# Google Tasks — integração do Tupiniquim AI Dev Studio

## Objetivo

Adicionar Google Tasks como camada operacional de tarefas do Tupiniquim sem expor senha Google, access token ou refresh token ao renderer, ao Git ou aos agentes.

A integração usa Google Tasks API v1 e OAuth 2.0 para aplicativo de computador, com PKCE e callback loopback restrito a `127.0.0.1`.

## Escopo OAuth

Para leitura e mutação de tarefas, solicitar somente:

```text
https://www.googleapis.com/auth/tasks
```

A integração não solicita Drive, Gmail, Calendar nem escopos de perfil Google.

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

Nunca preencher valores reais em `.env.example`, nunca versionar `.env.local` e nunca colar essas credenciais em issue, PR ou chat público.

## Fluxo implementado no desktop

```text
Painel Google Tasks no renderer
   |
   | IPC tipado, sem token
   v
Electron main process
   |
   | confirmação privilegiada ASSISTED
   | cria state + PKCE S256
   | inicia listener 127.0.0.1:<porta efêmera>
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
   | token cifrado fora do renderer
   v
Google Tasks API
```

O renderer recebe somente status de conexão, listas e tarefas. Access token, refresh token e Client Secret permanecem no processo principal.

## Componentes implementados

### `GoogleTasksOAuthClient`

- cria sessão OAuth com `state` e PKCE S256;
- troca authorization code por access/refresh token;
- renova access token;
- preserva refresh token quando o endpoint de refresh não devolve outro;
- revoga autorização;
- não incorpora corpo de erro ou credenciais em mensagens HTTP.

### `GoogleTasksApiClient`

- lista listas de tarefas com paginação;
- cria lista;
- lista tarefas com paginação;
- cria tarefa;
- atualiza tarefa;
- conclui tarefa;
- exclui tarefa;
- usa base URL oficial hard-coded da Google Tasks API.

### Bridge desktop

`apps/desktop/src/main/google-tasks-ipc.ts`:

- mantém OAuth e tokens somente no main process;
- persiste token via Electron `safeStorage` quando a criptografia do sistema está disponível;
- mantém token somente em memória quando `safeStorage` não está disponível;
- renova token automaticamente próximo da expiração;
- tenta um refresh adicional após HTTP 401;
- restringe callback a `127.0.0.1` e porta efêmera;
- aplica `PolicyEngine('ASSISTED')`;
- exige aprovação de leitura de rede por sessão;
- exige confirmação privilegiada para cada mutação;
- audita capacidade/resultado sem registrar token nem payload OAuth.

`apps/desktop/src/preload/bootstrap.ts` expõe somente `window.googleTasks` com operações tipadas. Nenhum método entrega token ao renderer.

### Painel do renderer

O painel flutuante `GoogleTasksDock` foi adicionado de forma modular, sem redesenhar `App.tsx`. Ele permite:

- conectar/desconectar Google Tasks;
- selecionar e atualizar listas;
- criar lista de projeto;
- listar tarefas;
- criar tarefa;
- concluir tarefa;
- excluir tarefa;
- visualizar estado de conexão e disponibilidade do armazenamento cifrado.

A API também suporta atualização de título/notas/prazo; essa capacidade está disponível no bridge mesmo que o painel inicial ainda não exponha todos os campos de edição.

## Organização sugerida

O painel oferece sugestões de nomes, mas **não cria nenhuma lista automaticamente**:

- Tupiniquim AI Dev Studio
- CRM Tupiniquim
- GlicoControl-MVP
- Top Tech BR
- Vanessa Braz
- MetalArt
- AI-LAB
- Geral

Esses nomes são conveniência de UI, não regras hard-coded de domínio.

## Segurança e testes

1. `GOOGLE_TASKS_CLIENT_ID` e `GOOGLE_TASKS_CLIENT_SECRET` são allowlisted somente no carregador privado de `.env.local`.
2. `.env.local` já é ignorado pelo Git.
3. Tokens OAuth não atravessam o preload.
4. Tokens OAuth não são registrados no `AuditLog` do bridge.
5. O callback OAuth aceita somente loopback `127.0.0.1` e valida `state`.
6. PKCE usa `S256`.
7. Endpoints OAuth/Tasks são definidos internamente, sem base URL arbitrária recebida do renderer.
8. Mutações permanecem sujeitas a confirmação humana no perfil `ASSISTED`.
9. Ao desconectar, o bridge tenta revogar a autorização e remove o token local mesmo se a revogação remota falhar.
10. Testes unitários usam HTTP mockado; CI não precisa de credenciais Google reais.
11. Testes de segurança verificam allowlist de segredos, isolamento do preload, loopback, `safeStorage`, validação de state, PKCE e ausência de tokens nos writes de auditoria.

## Como usar após configurar o OAuth Client

1. Preencher `GOOGLE_TASKS_CLIENT_ID` e, se aplicável, `GOOGLE_TASKS_CLIENT_SECRET` em `.env.local`.
2. Iniciar o app normalmente.
3. Abrir o botão **Tasks** no canto inferior direito.
4. Clicar em **Conectar Google Tasks**.
5. Confirmar a abertura do Google no diálogo privilegiado.
6. Autorizar o escopo Google Tasks no navegador.
7. Voltar ao Tupiniquim; o painel carregará listas e tarefas.
8. Confirmar individualmente operações mutáveis quando solicitado.

## Gate de entrega

A integração só deve sair de draft/ser considerada pronta para merge quando o CI remoto concluir com sucesso:

- lint;
- typecheck;
- unit tests;
- security tests;
- build.

Não reduzir nem contornar o `PolicyEngine` para fazer o gate passar.

## Referências oficiais

- Google Tasks API authorization: https://developers.google.com/workspace/tasks/auth
- OAuth 2.0 for Desktop Apps: https://developers.google.com/identity/protocols/oauth2/native-app
- Tasks API v1 reference: https://developers.google.com/workspace/tasks/reference/rest
