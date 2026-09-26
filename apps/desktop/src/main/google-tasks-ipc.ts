import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell, type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'
import {
  GOOGLE_TASKS_SCOPE,
  googleTasksConnectionState,
  err,
  googleTaskCompleteInputSchema,
  googleTaskCreateInputSchema,
  googleTaskDeleteInputSchema,
  googleTaskListCreateInputSchema,
  googleTaskListsInputSchema,
  googleTaskUpdateInputSchema,
  googleTasksIpcChannels,
  googleTasksListInputSchema,
  ok,
  toAppError,
  type GoogleTask,
  type GoogleTaskList,
  type GoogleTasksConnectionStatus,
  type GoogleTasksOAuthTokenSet,
  type Result
} from '@tupiniquim/contracts'
import {
  AuditLog,
  GoogleTasksApiClient,
  GoogleTasksHttpError,
  GoogleTasksOAuthClient,
  loadPrivateEnvironment
} from '@tupiniquim/adapters'
import { PolicyEngine, type ToolIntent } from '@tupiniquim/core'

const policy = new PolicyEngine('ASSISTED')
let networkReadApprovedForSession = false
let volatileToken: GoogleTasksOAuthTokenSet | null = null
let auditInstance: AuditLog | null = null

const storedTokenSchema = z.object({
  accessToken: z.string().min(8),
  refreshToken: z.string().min(8).optional(),
  expiresAt: z.string().datetime({ offset: true }),
  tokenType: z.literal('Bearer'),
  scope: z.array(z.string()).min(1)
})

const dataRoot = (): string => path.dirname(app.getPath('userData'))
const tokenPath = (): string => path.join(dataRoot(), 'google-tasks', 'oauth-token.bin')
const audit = (): AuditLog => {
  auditInstance ??= new AuditLog(dataRoot())
  return auditInstance
}

const trustedWindow = (event: IpcMainInvokeEvent): BrowserWindow | null => {
  const owner = BrowserWindow.fromWebContents(event.sender)
  if (owner === null || owner.isDestroyed()) return null
  const frame = event.senderFrame
  if (frame === null || frame.top !== frame) return null
  return owner
}

const readOAuthEnvironment = async (): Promise<{ clientId: string; clientSecret?: string }> => {
  const environment = await loadPrivateEnvironment(process.cwd())
  const clientId = environment.GOOGLE_TASKS_CLIENT_ID?.trim()
  if (clientId === undefined || clientId === '') {
    throw new Error('GOOGLE_TASKS_CLIENT_ID não configurado em .env.local.')
  }
  const clientSecret = environment.GOOGLE_TASKS_CLIENT_SECRET?.trim()
  return {
    clientId,
    ...(clientSecret === undefined || clientSecret === '' ? {} : { clientSecret })
  }
}

const oauthClient = async (): Promise<GoogleTasksOAuthClient> => {
  const config = await readOAuthEnvironment()
  return new GoogleTasksOAuthClient(config)
}

const loadToken = async (): Promise<GoogleTasksOAuthTokenSet | null> => {
  if (volatileToken !== null) return volatileToken
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    const encrypted = await readFile(tokenPath())
    const serialized = safeStorage.decryptString(encrypted)
    const parsed = storedTokenSchema.parse(JSON.parse(serialized) as unknown)
    if (!parsed.scope.includes(GOOGLE_TASKS_SCOPE)) return null
    volatileToken = parsed
    return parsed
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return null
    return null
  }
}

const saveToken = async (token: GoogleTasksOAuthTokenSet): Promise<void> => {
  const parsed = storedTokenSchema.parse(token)
  if (!parsed.scope.includes(GOOGLE_TASKS_SCOPE)) {
    throw new Error('O token Google não concedeu o escopo necessário de Tasks.')
  }
  volatileToken = parsed
  if (!safeStorage.isEncryptionAvailable()) return
  await mkdir(path.dirname(tokenPath()), { recursive: true })
  await writeFile(tokenPath(), safeStorage.encryptString(JSON.stringify(parsed)), { mode: 0o600 })
}

const clearToken = async (): Promise<void> => {
  volatileToken = null
  await rm(tokenPath(), { force: true }).catch(() => undefined)
}

const connectionStatus = async (): Promise<GoogleTasksConnectionStatus> => {
  let configured: boolean
  try {
    await readOAuthEnvironment()
    configured = true
  } catch {
    configured = false
  }
  const authenticated = configured && (await loadToken()) !== null
  return {
    state: googleTasksConnectionState(configured, authenticated),
    configured,
    authenticated,
    secureStorageAvailable: safeStorage.isEncryptionAvailable(),
    scope: GOOGLE_TASKS_SCOPE
  }
}

const confirmPolicy = async (
  owner: BrowserWindow,
  intent: ToolIntent,
  message: string,
  detail: string,
  approveLabel = 'Permitir'
): Promise<void> => {
  const decision = policy.evaluate(intent)
  if (!decision.allowed) throw new Error(decision.reason)
  if (!decision.requiresApproval) return
  const confirmation = await dialog.showMessageBox(owner, {
    type: intent.destructive ? 'warning' : 'question',
    title: 'Google Tasks · autorização',
    message,
    detail,
    buttons: [approveLabel, 'Cancelar'],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  })
  if (confirmation.response !== 0) throw new Error('Operação Google Tasks cancelada pelo usuário.')
}

const approveNetworkRead = async (owner: BrowserWindow): Promise<void> => {
  if (networkReadApprovedForSession) return
  await confirmPolicy(
    owner,
    {
      capability: 'google-tasks.read',
      target: 'https://tasks.googleapis.com',
      risk: 'MEDIUM',
      destructive: false,
      requiresNetwork: true
    },
    'Permitir leitura do Google Tasks nesta sessão?',
    'O Tupiniquim poderá listar suas listas e tarefas. Tokens OAuth permanecem no processo principal e não são enviados ao renderer.',
    'Permitir nesta sessão'
  )
  networkReadApprovedForSession = true
}

const approveMutation = async (
  owner: BrowserWindow,
  capability: string,
  message: string,
  detail: string
): Promise<void> => {
  await confirmPolicy(
    owner,
    {
      capability,
      target: 'https://tasks.googleapis.com',
      risk: 'HIGH',
      destructive: true,
      requiresNetwork: true
    },
    message,
    detail,
    'Confirmar alteração'
  )
}

const closeServer = async (server: Server): Promise<void> => await new Promise<void>((resolve) => {
  server.close(() => resolve())
})

const authorizeWithLoopback = async (oauth: GoogleTasksOAuthClient): Promise<GoogleTasksOAuthTokenSet> => {
  let redirectUri = ''
  let expectedState = ''
  let settled = false
  let resolveCode!: (code: string) => void
  let rejectCode!: (cause: Error) => void
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve
    rejectCode = reject
  })

  const server = createServer((request, response) => {
    if (redirectUri === '') {
      response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('OAuth ainda não inicializado.')
      return
    }
    const callback = new URL(request.url ?? '/', redirectUri)
    if (callback.pathname !== '/oauth/callback') {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }

    const receivedState = callback.searchParams.get('state')
    const oauthError = callback.searchParams.get('error')
    const code = callback.searchParams.get('code')
    const valid = receivedState === expectedState && oauthError === null && code !== null && code !== ''

    response.writeHead(valid ? 200 : 400, {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
      'cache-control': 'no-store'
    })
    response.end(valid
      ? '<!doctype html><meta charset="utf-8"><title>Tupiniquim</title><body style="font-family:sans-serif;padding:32px"><h1>Google Tasks conectado</h1><p>Você pode fechar esta janela e voltar ao Tupiniquim.</p></body>'
      : '<!doctype html><meta charset="utf-8"><title>Tupiniquim</title><body style="font-family:sans-serif;padding:32px"><h1>Autorização recusada</h1><p>Volte ao Tupiniquim e tente novamente.</p></body>')

    if (settled) return
    settled = true
    if (receivedState !== expectedState) rejectCode(new Error('Callback OAuth recusado por state inválido.'))
    else if (oauthError !== null) rejectCode(new Error('O Google não autorizou o acesso ao Tasks.'))
    else if (code === null || code === '') rejectCode(new Error('Callback OAuth não retornou authorization code.'))
    else resolveCode(code)
  })

  await new Promise<void>((resolve, reject) => {
    const onError = (cause: Error): void => reject(cause)
    server.once('error', onError)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError)
      resolve()
    })
  })

  const address = server.address() as AddressInfo | null
  if (address === null) {
    await closeServer(server)
    throw new Error('Não foi possível reservar callback OAuth local.')
  }

  redirectUri = `http://127.0.0.1:${String(address.port)}/oauth/callback`
  const session = oauth.createAuthorizationSession({ redirectUri })
  expectedState = session.state

  const timeout = setTimeout(() => {
    if (settled) return
    settled = true
    rejectCode(new Error('Tempo de autorização Google Tasks expirado.'))
  }, 180_000)

  try {
    await shell.openExternal(session.authorizationUrl)
    const code = await codePromise
    return await oauth.exchangeAuthorizationCode({
      code,
      redirectUri,
      codeVerifier: session.codeVerifier
    })
  } finally {
    clearTimeout(timeout)
    await closeServer(server)
  }
}

const freshToken = async (): Promise<GoogleTasksOAuthTokenSet> => {
  const token = await loadToken()
  if (token === null) throw new Error('Google Tasks não está conectado.')
  const expiresAt = Date.parse(token.expiresAt)
  if (Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000) return token
  if (token.refreshToken === undefined) {
    await clearToken()
    throw new Error('Sessão Google Tasks expirou; conecte novamente.')
  }
  const refreshed = await (await oauthClient()).refreshAccessToken(token.refreshToken)
  await saveToken(refreshed)
  return refreshed
}

const withApi = async <T>(operation: (client: GoogleTasksApiClient) => Promise<T>): Promise<T> => {
  let token = await freshToken()
  try {
    return await operation(new GoogleTasksApiClient({ accessToken: token.accessToken }))
  } catch (cause) {
    if (!(cause instanceof GoogleTasksHttpError) || cause.status !== 401 || token.refreshToken === undefined) throw cause
    token = await (await oauthClient()).refreshAccessToken(token.refreshToken)
    await saveToken(token)
    return await operation(new GoogleTasksApiClient({ accessToken: token.accessToken }))
  }
}

const register = <I, O>(
  channel: string,
  schema: z.ZodType<I>,
  capability: string,
  handler: (owner: BrowserWindow, input: I) => Promise<O> | O
): void => {
  ipcMain.handle(channel, async (event, raw: unknown): Promise<Result<O>> => {
    const requestId = randomUUID()
    const started = Date.now()
    const owner = trustedWindow(event)
    if (owner === null) {
      await audit().write({
        requestId,
        at: new Date().toISOString(),
        capability,
        outcome: 'DENIED',
        durationMs: Date.now() - started,
        errorCode: 'UNTRUSTED_SENDER'
      })
      return err('UNTRUSTED_SENDER', 'Origem IPC não autorizada.')
    }
    try {
      const input = schema.parse(raw)
      const value = await handler(owner, input)
      await audit().write({
        requestId,
        at: new Date().toISOString(),
        capability,
        outcome: 'SUCCESS',
        durationMs: Date.now() - started
      })
      return ok(value)
    } catch (cause) {
      const error = toAppError(cause, 'GOOGLE_TASKS_ERROR')
      await audit().write({
        requestId,
        at: new Date().toISOString(),
        capability,
        outcome: 'ERROR',
        durationMs: Date.now() - started,
        errorCode: error.code
      }).catch(() => undefined)
      return { ok: false, error }
    }
  })
}

export const registerGoogleTasksIpc = (): void => {
  register(googleTasksIpcChannels.status, z.undefined(), 'google-tasks.status', async () => await connectionStatus())

  register(googleTasksIpcChannels.connect, z.undefined(), 'google-tasks.connect', async (owner) => {
    await confirmPolicy(
      owner,
      {
        capability: 'google-tasks.connect',
        target: 'https://accounts.google.com',
        risk: 'MEDIUM',
        destructive: false,
        requiresNetwork: true
      },
      'Conectar o Tupiniquim ao Google Tasks?',
      'O navegador do sistema será aberto para consentimento OAuth. O Tupiniquim solicitará somente o escopo Google Tasks.',
      'Abrir Google'
    )
    const oauth = await oauthClient()
    const token = await authorizeWithLoopback(oauth)
    await saveToken(token)
    networkReadApprovedForSession = true
    return await connectionStatus()
  })

  register(googleTasksIpcChannels.disconnect, z.undefined(), 'google-tasks.disconnect', async (owner) => {
    const token = await loadToken()
    if (token === null) return await connectionStatus()
    await approveMutation(
      owner,
      'google-tasks.disconnect',
      'Desconectar o Google Tasks?',
      'O token OAuth local será apagado e a autorização será revogada no Google quando possível.'
    )
    try {
      await (await oauthClient()).revoke(token.refreshToken ?? token.accessToken)
    } finally {
      await clearToken()
      networkReadApprovedForSession = false
    }
    return await connectionStatus()
  })

  register(googleTasksIpcChannels.taskLists, googleTaskListsInputSchema, 'google-tasks.task-lists', async (owner, input): Promise<GoogleTaskList[]> => {
    await approveNetworkRead(owner)
    return await withApi(async (client) => await client.listTaskLists(input.maxResults))
  })

  register(googleTasksIpcChannels.createTaskList, googleTaskListCreateInputSchema, 'google-tasks.task-list.create', async (owner, input): Promise<GoogleTaskList> => {
    await approveMutation(owner, 'google-tasks.task-list.create', 'Criar uma lista no Google Tasks?', `Nova lista: ${input.title}`)
    return await withApi(async (client) => await client.createTaskList(input.title))
  })

  register(googleTasksIpcChannels.tasks, googleTasksListInputSchema, 'google-tasks.tasks', async (owner, input): Promise<GoogleTask[]> => {
    await approveNetworkRead(owner)
    return await withApi(async (client) => await client.listTasks(input))
  })

  register(googleTasksIpcChannels.createTask, googleTaskCreateInputSchema, 'google-tasks.task.create', async (owner, input): Promise<GoogleTask> => {
    await approveMutation(owner, 'google-tasks.task.create', 'Criar esta tarefa no Google Tasks?', `Tarefa: ${input.title}`)
    return await withApi(async (client) => await client.createTask(input))
  })

  register(googleTasksIpcChannels.updateTask, googleTaskUpdateInputSchema, 'google-tasks.task.update', async (owner, input): Promise<GoogleTask> => {
    await approveMutation(owner, 'google-tasks.task.update', 'Atualizar esta tarefa no Google Tasks?', `Task ID: ${input.taskId}`)
    return await withApi(async (client) => await client.updateTask(input))
  })

  register(googleTasksIpcChannels.completeTask, googleTaskCompleteInputSchema, 'google-tasks.task.complete', async (owner, input): Promise<GoogleTask> => {
    await approveMutation(owner, 'google-tasks.task.complete', 'Marcar esta tarefa como concluída?', `Task ID: ${input.taskId}`)
    return await withApi(async (client) => await client.completeTask(input))
  })

  register(googleTasksIpcChannels.deleteTask, googleTaskDeleteInputSchema, 'google-tasks.task.delete', async (owner, input): Promise<void> => {
    await approveMutation(owner, 'google-tasks.task.delete', 'Excluir esta tarefa do Google Tasks?', `Task ID: ${input.taskId}`)
    await withApi(async (client) => await client.deleteTask(input))
  })
}
