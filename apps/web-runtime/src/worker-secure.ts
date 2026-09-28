import { authorizeAccessRequest, scopeWorkspaceId, type AccessAuthConfig } from './access-auth'
import fullWorker, { Sandbox, WebState } from './worker-full'
export { Sandbox, WebState }

type FullEnv = Parameters<typeof fullWorker.fetch>[1] & AccessAuthConfig

const authError = (input: { status: 401 | 403 | 503; code: string; message: string }): Response => Response.json({
  ok: false,
  error: {
    code: input.code,
    message: input.message,
    retryable: input.status === 503
  }
}, { status: input.status })

const scopedRequest = async (request: Request, identity: { email: string; sub: string; issuer: string; audience: string[] }): Promise<Request> => {
  const url = new URL(request.url)
  const clientWorkspaceId = request.headers.get('x-tupiniquim-workspace') ?? url.searchParams.get('workspace')
  if (clientWorkspaceId === null || clientWorkspaceId.trim() === '') return request

  const headers = new Headers(request.headers)
  headers.set('x-tupiniquim-workspace', await scopeWorkspaceId(identity, clientWorkspaceId.trim()))
  headers.delete('cf-access-authenticated-user-email')
  return new Request(request, { headers })
}

export default {
  async fetch(request: Request, env: FullEnv): Promise<Response> {
    const url = new URL(request.url)
    const protectedRuntimeRoute = url.pathname === '/api/studio' || url.pathname.startsWith('/ws/')
    if (!protectedRuntimeRoute) return fullWorker.fetch(request, env)

    const authorization = await authorizeAccessRequest(request, env)
    if (!authorization.allowed) return authError(authorization)
    if (authorization.anonymous) return fullWorker.fetch(request, env)

    return fullWorker.fetch(await scopedRequest(request, authorization.identity), env)
  }
}
