import { createHash, randomBytes } from 'node:crypto'
import {
  GOOGLE_TASKS_SCOPE,
  googleTaskListSchema,
  googleTaskSchema,
  type GoogleTask,
  type GoogleTaskList,
  type GoogleTasksOAuthTokenSet
} from '@tupiniquim/contracts'

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'
const TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1'

export interface GoogleTasksOAuthClientConfig {
  clientId: string
  clientSecret?: string
  fetch?: typeof fetch
  now?: () => number
}

export interface GoogleTasksAuthorizationRequest {
  redirectUri: string
  state?: string
}

export interface GoogleTasksAuthorizationSession {
  authorizationUrl: string
  state: string
  codeVerifier: string
}

export interface GoogleTasksApiClientOptions {
  accessToken: string
  fetch?: typeof fetch
}

interface GoogleTokenEndpointResponse {
  access_token?: unknown
  refresh_token?: unknown
  expires_in?: unknown
  token_type?: unknown
  scope?: unknown
}

const formHeaders = { 'content-type': 'application/x-www-form-urlencoded' } as const
const jsonHeaders = { 'content-type': 'application/json' } as const

const assertSuccessfulResponse = async (response: Response, label: string): Promise<void> => {
  if (response.ok) return
  const retryable = response.status === 429 || response.status >= 500
  throw new GoogleTasksHttpError(`${label} retornou HTTP ${String(response.status)}.`, response.status, retryable)
}

export class GoogleTasksHttpError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean
  ) {
    super(message)
    this.name = 'GoogleTasksHttpError'
  }
}

const decodeTokenEndpointResponse = async (
  response: Response,
  previousRefreshToken: string | undefined,
  now: () => number
): Promise<GoogleTasksOAuthTokenSet> => {
  await assertSuccessfulResponse(response, 'Google OAuth')
  const raw = await response.json() as GoogleTokenEndpointResponse
  if (typeof raw.access_token !== 'string' || raw.access_token.length < 8) {
    throw new Error('Google OAuth não retornou um access token válido.')
  }
  if (typeof raw.expires_in !== 'number' || !Number.isFinite(raw.expires_in) || raw.expires_in <= 0) {
    throw new Error('Google OAuth não retornou uma validade de token válida.')
  }
  if (raw.token_type !== undefined && raw.token_type !== 'Bearer') {
    throw new Error('Google OAuth retornou um tipo de token não suportado.')
  }
  const refreshToken = typeof raw.refresh_token === 'string' && raw.refresh_token !== ''
    ? raw.refresh_token
    : previousRefreshToken
  const scopes = typeof raw.scope === 'string' && raw.scope.trim() !== ''
    ? raw.scope.trim().split(/\s+/u)
    : [GOOGLE_TASKS_SCOPE]

  return {
    accessToken: raw.access_token,
    ...(refreshToken === undefined ? {} : { refreshToken }),
    expiresAt: new Date(now() + raw.expires_in * 1000).toISOString(),
    tokenType: 'Bearer',
    scope: scopes
  }
}

const createPkce = (): { codeVerifier: string; codeChallenge: string } => {
  const codeVerifier = randomBytes(48).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

export class GoogleTasksOAuthClient {
  private readonly fetcher: typeof fetch
  private readonly now: () => number

  public constructor(private readonly config: GoogleTasksOAuthClientConfig) {
    if (config.clientId.trim() === '') throw new Error('GOOGLE_TASKS_CLIENT_ID não configurado.')
    this.fetcher = config.fetch ?? fetch
    this.now = config.now ?? Date.now
  }

  public createAuthorizationSession(request: GoogleTasksAuthorizationRequest): GoogleTasksAuthorizationSession {
    const { codeVerifier, codeChallenge } = createPkce()
    const state = request.state ?? randomBytes(24).toString('base64url')
    const url = new URL(AUTHORIZATION_ENDPOINT)
    url.searchParams.set('client_id', this.config.clientId)
    url.searchParams.set('redirect_uri', request.redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', GOOGLE_TASKS_SCOPE)
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('include_granted_scopes', 'true')
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')
    return { authorizationUrl: url.toString(), state, codeVerifier }
  }

  public async exchangeAuthorizationCode(input: {
    code: string
    redirectUri: string
    codeVerifier: string
  }): Promise<GoogleTasksOAuthTokenSet> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      code: input.code,
      code_verifier: input.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri
    })
    if (this.config.clientSecret !== undefined && this.config.clientSecret !== '') {
      body.set('client_secret', this.config.clientSecret)
    }
    const response = await this.fetcher(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: formHeaders,
      body
    })
    return await decodeTokenEndpointResponse(response, undefined, this.now)
  }

  public async refreshAccessToken(refreshToken: string): Promise<GoogleTasksOAuthTokenSet> {
    if (refreshToken.trim() === '') throw new Error('Refresh token vazio.')
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
    if (this.config.clientSecret !== undefined && this.config.clientSecret !== '') {
      body.set('client_secret', this.config.clientSecret)
    }
    const response = await this.fetcher(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: formHeaders,
      body
    })
    return await decodeTokenEndpointResponse(response, refreshToken, this.now)
  }

  public async revoke(token: string): Promise<void> {
    if (token.trim() === '') return
    const response = await this.fetcher(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: formHeaders,
      body: new URLSearchParams({ token })
    })
    await assertSuccessfulResponse(response, 'Revogação Google OAuth')
  }
}

interface GoogleCollectionResponse {
  items?: unknown
  nextPageToken?: unknown
}

export class GoogleTasksApiClient {
  private readonly fetcher: typeof fetch

  public constructor(private readonly options: GoogleTasksApiClientOptions) {
    if (options.accessToken.trim() === '') throw new Error('Access token vazio.')
    this.fetcher = options.fetch ?? fetch
  }

  private async request(pathname: string, init: RequestInit = {}): Promise<Response> {
    if (!pathname.startsWith('/')) throw new Error('Caminho Google Tasks inválido.')
    const response = await this.fetcher(`${TASKS_API_BASE}${pathname}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.options.accessToken}`,
        ...(init.body === undefined ? {} : jsonHeaders),
        ...init.headers
      }
    })
    await assertSuccessfulResponse(response, 'Google Tasks API')
    return response
  }

  public async listTaskLists(maxResults = 100): Promise<GoogleTaskList[]> {
    const result: GoogleTaskList[] = []
    let pageToken: string | undefined
    do {
      const query = new URLSearchParams({ maxResults: String(Math.max(1, Math.min(100, maxResults))) })
      if (pageToken !== undefined) query.set('pageToken', pageToken)
      const response = await this.request(`/users/@me/lists?${query.toString()}`)
      const payload = await response.json() as GoogleCollectionResponse
      const items = Array.isArray(payload.items) ? payload.items : []
      result.push(...items.map((item) => googleTaskListSchema.parse(item)))
      pageToken = typeof payload.nextPageToken === 'string' && payload.nextPageToken !== ''
        ? payload.nextPageToken
        : undefined
    } while (pageToken !== undefined)
    return result
  }

  public async listTasks(input: {
    taskListId: string
    showCompleted?: boolean
    showHidden?: boolean
    maxResults?: number
  }): Promise<GoogleTask[]> {
    const result: GoogleTask[] = []
    let pageToken: string | undefined
    do {
      const query = new URLSearchParams({
        maxResults: String(Math.max(1, Math.min(100, input.maxResults ?? 100))),
        showCompleted: String(input.showCompleted ?? true),
        showHidden: String(input.showHidden ?? false)
      })
      if (pageToken !== undefined) query.set('pageToken', pageToken)
      const response = await this.request(`/lists/${encodeURIComponent(input.taskListId)}/tasks?${query.toString()}`)
      const payload = await response.json() as GoogleCollectionResponse
      const items = Array.isArray(payload.items) ? payload.items : []
      result.push(...items.map((item) => googleTaskSchema.parse(item)))
      pageToken = typeof payload.nextPageToken === 'string' && payload.nextPageToken !== ''
        ? payload.nextPageToken
        : undefined
    } while (pageToken !== undefined)
    return result
  }

  public async createTask(input: {
    taskListId: string
    title: string
    notes?: string
    due?: string
  }): Promise<GoogleTask> {
    const response = await this.request(`/lists/${encodeURIComponent(input.taskListId)}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        ...(input.notes === undefined ? {} : { notes: input.notes }),
        ...(input.due === undefined ? {} : { due: input.due })
      })
    })
    return googleTaskSchema.parse(await response.json())
  }

  public async updateTask(input: {
    taskListId: string
    taskId: string
    title?: string
    notes?: string | null
    due?: string | null
  }): Promise<GoogleTask> {
    const body: Record<string, unknown> = {}
    if (input.title !== undefined) body.title = input.title
    if (input.notes !== undefined) body.notes = input.notes
    if (input.due !== undefined) body.due = input.due
    const response = await this.request(
      `/lists/${encodeURIComponent(input.taskListId)}/tasks/${encodeURIComponent(input.taskId)}`,
      { method: 'PATCH', body: JSON.stringify(body) }
    )
    return googleTaskSchema.parse(await response.json())
  }

  public async completeTask(input: { taskListId: string; taskId: string }, completedAt = new Date()): Promise<GoogleTask> {
    const response = await this.request(
      `/lists/${encodeURIComponent(input.taskListId)}/tasks/${encodeURIComponent(input.taskId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed', completed: completedAt.toISOString() })
      }
    )
    return googleTaskSchema.parse(await response.json())
  }

  public async deleteTask(input: { taskListId: string; taskId: string }): Promise<void> {
    await this.request(
      `/lists/${encodeURIComponent(input.taskListId)}/tasks/${encodeURIComponent(input.taskId)}`,
      { method: 'DELETE' }
    )
  }
}
