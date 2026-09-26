import fullWorker, { Sandbox, WebState } from './worker-full'
export { Sandbox, WebState }

type FullEnv = Parameters<typeof fullWorker.fetch>[1] & { WEB_ALLOW_ANONYMOUS?: string }

const identityAllowed = (request: Request, env: FullEnv): boolean => {
  const accessIdentity = request.headers.get('cf-access-authenticated-user-email')
  if (accessIdentity !== null && accessIdentity.trim() !== '') return true
  return env.WEB_ALLOW_ANONYMOUS === 'true'
}

const unauthorized = (): Response => Response.json({
  ok: false,
  error: {
    code: 'WEB_AUTH_REQUIRED',
    message: 'A edição Web requer uma identidade autenticada.',
    retryable: false
  }
}, { status: 401 })

export default {
  fetch(request: Request, env: FullEnv): Promise<Response> | Response {
    const url = new URL(request.url)
    const protectedRuntimeRoute = url.pathname === '/api/studio' || url.pathname.startsWith('/ws/')
    if (protectedRuntimeRoute && !identityAllowed(request, env)) return unauthorized()
    return fullWorker.fetch(request, env)
  }
}
