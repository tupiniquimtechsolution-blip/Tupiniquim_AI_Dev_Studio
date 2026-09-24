export interface Env {
  DEPLOYMENT_MODE: string
  RELEASE_STATE: string
  MASTER_WAVE: string
  WAVE_STATE: string
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
        masterWave: env.MASTER_WAVE,
        waveState: env.WAVE_STATE,
        releaseState: env.RELEASE_STATE,
        sourceOfTruth: 'github',
        guarantees: {
          githubSourceOfTruth: true,
          cloudPreview: true,
          windowsCertified: false
        },
        integrations: {
          googleDrive: 'archive-and-evidence',
          cloudflare: 'control-plane-preview',
          supabase: 'optional-explicit-project',
          windows: 'release-certification-only'
        },
        deferred: ['Electron packaging', 'ConPTY', 'local Ollama/hardware', 'human OAuth flows']
      })
    }

    if (url.pathname === '/integrations') {
      return json({
        github: { role: 'source-of-truth', configured: true },
        googleDrive: { role: 'archive-and-evidence', configured: true },
        cloudflare: { role: 'control-plane-preview', configured: true },
        supabase: { role: 'optional-project-platform', configured: false, requiresExplicitProject: true }
      })
    }

    return json({ error: 'NOT_FOUND' }, { status: 404 })
  }
}
