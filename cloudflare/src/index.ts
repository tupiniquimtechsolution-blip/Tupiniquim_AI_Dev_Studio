export interface Env {
  DEPLOYMENT_MODE: string
  RELEASE_STATE: string
}

const json = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers ?? {})
    }
  })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/healthz') {
      return json({ ok: true, service: 'tupiniquim-cloud-control-plane' })
    }

    if (url.pathname === '/status' || url.pathname === '/') {
      return json({
        service: 'Tupiniquim AI Dev Studio Cloud Control Plane',
        mode: env.DEPLOYMENT_MODE,
        releaseState: env.RELEASE_STATE,
        guarantees: {
          githubSourceOfTruth: true,
          cloudPreview: true,
          windowsCertified: false
        },
        deferred: ['Electron packaging', 'ConPTY', 'local Ollama/hardware', 'human OAuth flows']
      })
    }

    return json({ error: 'NOT_FOUND' }, { status: 404 })
  }
}
