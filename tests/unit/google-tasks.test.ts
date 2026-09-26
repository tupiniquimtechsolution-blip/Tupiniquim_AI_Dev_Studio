import { describe, expect, it } from 'vitest'
import { GOOGLE_TASKS_SCOPE, googleTasksConnectionState } from '@tupiniquim/contracts'
import { GoogleTasksApiClient, GoogleTasksHttpError, GoogleTasksOAuthClient } from '@tupiniquim/adapters'

const jsonResponse = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json' }
})

const requestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

const requestBodyText = (body: BodyInit | null | undefined): string | undefined => {
  if (body === undefined || body === null) return undefined
  if (typeof body === 'string') return body
  if (body instanceof URLSearchParams) return body.toString()
  throw new Error('Body de teste inesperado.')
}

describe('GoogleTasksOAuthClient', () => {
  it('gera autorização desktop com escopo mínimo, PKCE e state', () => {
    const client = new GoogleTasksOAuthClient({ clientId: 'desktop.apps.googleusercontent.com' })
    const session = client.createAuthorizationSession({
      redirectUri: 'http://127.0.0.1:45678/oauth/callback',
      state: 'known-state'
    })
    const url = new URL(session.authorizationUrl)

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe('desktop.apps.googleusercontent.com')
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:45678/oauth/callback')
    expect(url.searchParams.get('scope')).toBe(GOOGLE_TASKS_SCOPE)
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('state')).toBe('known-state')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{40,}$/u)
    expect(session.codeVerifier).toMatch(/^[A-Za-z0-9_-]{40,}$/u)
  })

  it('troca authorization code e preserva somente dados normalizados do token', async () => {
    let submitted: URLSearchParams | undefined
    const fetcher = ((_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      submitted = init?.body as URLSearchParams
      return Promise.resolve(jsonResponse({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: GOOGLE_TASKS_SCOPE
      }))
    }) as typeof fetch
    const client = new GoogleTasksOAuthClient({
      clientId: 'desktop.apps.googleusercontent.com',
      clientSecret: 'client-secret',
      fetch: fetcher,
      now: () => Date.parse('2026-09-17T12:00:00.000Z')
    })

    const token = await client.exchangeAuthorizationCode({
      code: 'authorization-code',
      redirectUri: 'http://127.0.0.1:45678/oauth/callback',
      codeVerifier: 'verifier'
    })

    expect(submitted?.get('grant_type')).toBe('authorization_code')
    expect(submitted?.get('client_secret')).toBe('client-secret')
    expect(submitted?.get('code_verifier')).toBe('verifier')
    expect(token).toEqual({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
      expiresAt: '2026-09-17T13:00:00.000Z',
      tokenType: 'Bearer',
      scope: [GOOGLE_TASKS_SCOPE]
    })
  })

  it('mantém o refresh token anterior quando o refresh não devolve outro', async () => {
    const fetcher = (() => Promise.resolve(jsonResponse({
      access_token: 'renewed-access-token',
      expires_in: 1800,
      token_type: 'Bearer',
      scope: GOOGLE_TASKS_SCOPE
    }))) as typeof fetch
    const client = new GoogleTasksOAuthClient({
      clientId: 'desktop.apps.googleusercontent.com',
      fetch: fetcher,
      now: () => Date.parse('2026-09-17T12:00:00.000Z')
    })

    const token = await client.refreshAccessToken('existing-refresh-token')

    expect(token.refreshToken).toBe('existing-refresh-token')
    expect(token.expiresAt).toBe('2026-09-17T12:30:00.000Z')
  })
})

describe('GoogleTasksApiClient', () => {
  it('pagina listas sem expor o bearer token na resposta', async () => {
    const calls: string[] = []
    const fetcher = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = requestUrl(input)
      calls.push(url)
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer private-access-token')
      if (calls.length === 1) {
        return Promise.resolve(jsonResponse({
          items: [{ id: 'list-1', title: 'CRM Tupiniquim' }],
          nextPageToken: 'next-page'
        }))
      }
      return Promise.resolve(jsonResponse({ items: [{ id: 'list-2', title: 'Top Tech BR' }] }))
    }) as typeof fetch
    const client = new GoogleTasksApiClient({ accessToken: 'private-access-token', fetch: fetcher })

    const lists = await client.listTaskLists()

    expect(lists.map((item) => item.title)).toEqual(['CRM Tupiniquim', 'Top Tech BR'])
    expect(calls).toHaveLength(2)
    expect(calls[1]).toContain('pageToken=next-page')
    expect(JSON.stringify(lists)).not.toContain('private-access-token')
  })

  it('cria tarefa e conclui tarefa com PATCH explícito', async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = []
    const fetcher = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const bodyText = requestBodyText(init?.body)
      const body = bodyText === undefined ? undefined : JSON.parse(bodyText) as unknown
      calls.push({ url: requestUrl(input), method: init?.method ?? 'GET', body })
      if (calls.length === 1) {
        return Promise.resolve(jsonResponse({ id: 'task-1', title: 'Revisar CI', status: 'needsAction' }))
      }
      return Promise.resolve(jsonResponse({
        id: 'task-1',
        title: 'Revisar CI',
        status: 'completed',
        completed: '2026-09-17T15:00:00.000Z'
      }))
    }) as typeof fetch
    const client = new GoogleTasksApiClient({ accessToken: 'token', fetch: fetcher })

    const created = await client.createTask({ taskListId: 'project-list', title: 'Revisar CI' })
    const completed = await client.completeTask(
      { taskListId: 'project-list', taskId: created.id },
      new Date('2026-09-17T15:00:00.000Z')
    )

    expect(calls[0]).toMatchObject({ method: 'POST', body: { title: 'Revisar CI' } })
    expect(calls[1]).toMatchObject({
      method: 'PATCH',
      body: { status: 'completed', completed: '2026-09-17T15:00:00.000Z' }
    })
    expect(completed.status).toBe('completed')
  })

  it('não incorpora token secreto no erro HTTP', async () => {
    const fetcher = (() => Promise.resolve(jsonResponse({ error: 'invalid private-access-token' }, 401))) as typeof fetch
    const client = new GoogleTasksApiClient({ accessToken: 'private-access-token', fetch: fetcher })

    const attempt = client.listTasks({ taskListId: 'list-1' })

    await expect(attempt).rejects.toBeInstanceOf(GoogleTasksHttpError)
    await expect(attempt).rejects.not.toThrow(/private-access-token/u)
  })
})

it('reports NOT_CONFIGURED without credentials even when a stale token exists', () => {
  expect(googleTasksConnectionState(false, false)).toBe('NOT_CONFIGURED')
  expect(googleTasksConnectionState(false, true)).toBe('NOT_CONFIGURED')
  expect(googleTasksConnectionState(true, false)).toBe('AUTH_REQUIRED')
  expect(googleTasksConnectionState(true, true)).toBe('READY')
})
