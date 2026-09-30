import { afterEach, describe, expect, it, vi } from 'vitest'
import { gateLockReason, remoteRuntimeReadiness, remoteRuntimeStatus, type RemoteRuntimeStatus } from '../../apps/web-runtime/src/remote-runtime'

const CONFIGURED_ENV = {
  WEB_REMOTE_RUNTIME_ENABLED: 'true',
  REMOTE_RUNTIME_URL: 'https://runtime.example.com',
  REMOTE_RUNTIME_TOKEN: 'x'.repeat(32)
}

describe('Web Remote Runtime readiness', () => {
  it('fica desativado por padrão sem exigir segredo', () => {
    expect(remoteRuntimeReadiness({})).toEqual({
      state: 'DISABLED',
      configured: false,
      online: false,
      transport: 'https-tunnel'
    })
  })

  it('falha fechado quando habilitado sem URL/token', () => {
    const status = remoteRuntimeReadiness({ WEB_REMOTE_RUNTIME_ENABLED: 'true' })
    expect(status).toMatchObject({ state: 'MISCONFIGURED', configured: false, online: false })
    expect(status.detail).toContain('REMOTE_RUNTIME_URL')
    expect(status.detail).toContain('REMOTE_RUNTIME_TOKEN')
  })

  it('só fica configurado quando URL e token existem', () => {
    expect(remoteRuntimeReadiness(CONFIGURED_ENV)).toMatchObject({ state: 'OFFLINE', configured: true, online: false, transport: 'https-tunnel' })
  })
})

describe('Web Remote Runtime status (health do gateway)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('READY quando /health responde, com platform e capabilities sanitizadas', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(Response.json({ ok: true, platform: 'win32', capabilities: ['files', 'git', 'terminal', 'gates'] }))))
    const status = await remoteRuntimeStatus(CONFIGURED_ENV)
    expect(status).toMatchObject({ state: 'READY', configured: true, online: true, transport: 'https-tunnel', platform: 'win32' })
    expect(status.capabilities).toEqual(['files', 'git', 'terminal', 'gates'])
    // Nunca vazar credenciais/URL no status exposto à UI.
    expect(JSON.stringify(status)).not.toMatch(/x{32}|runtime\.example\.com|bearer/i)
  })

  it('OFFLINE quando o gateway responde HTTP de erro', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('nope', { status: 502 }))))
    const status = await remoteRuntimeStatus(CONFIGURED_ENV)
    expect(status).toMatchObject({ state: 'OFFLINE', configured: true, online: false })
    expect(status.detail).toContain('502')
  })

  it('OFFLINE quando o fetch falha (túnel indisponível), sem vazar token', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('getaddrinfo ENOTFOUND runtime.example.com'))))
    const status = await remoteRuntimeStatus(CONFIGURED_ENV)
    expect(status).toMatchObject({ state: 'OFFLINE', configured: true, online: false })
    expect(JSON.stringify(status)).not.toContain('x'.repeat(32))
  })

  it('DISABLED/MISCONFIGURED não tentam rede', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    expect(await remoteRuntimeStatus({})).toMatchObject({ state: 'DISABLED', online: false })
    expect(await remoteRuntimeStatus({ WEB_REMOTE_RUNTIME_ENABLED: 'true' })).toMatchObject({ state: 'MISCONFIGURED', online: false })
    expect(spy).not.toHaveBeenCalled()
  })

  it('autentica no gateway com Bearer sem expor o token no status', async () => {
    const spy = vi.fn((_url: unknown, init?: { headers?: Headers }) => {
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${'x'.repeat(32)}`)
      return Promise.resolve(Response.json({ ok: true }))
    })
    vi.stubGlobal('fetch', spy)
    const status = await remoteRuntimeStatus(CONFIGURED_ENV)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(status.state).toBe('READY')
    expect(Object.keys(status)).not.toContain('token')
  })
})

describe('gateLockReason (Toolbox fail-closed com mensagem por estado)', () => {
  const status = (partial: Partial<RemoteRuntimeStatus>): RemoteRuntimeStatus => ({
    state: 'DISABLED', configured: false, online: false, transport: 'https-tunnel', ...partial
  })

  it('READY libera a execução (null)', () => {
    expect(gateLockReason(status({ state: 'READY', configured: true, online: true }))).toBeNull()
  })

  it('DISABLED, MISCONFIGURED e OFFLINE bloqueiam com mensagens distintas e específicas', () => {
    const disabled = gateLockReason(status({ state: 'DISABLED' }))
    const misconfigured = gateLockReason(status({ state: 'MISCONFIGURED', detail: 'Ausente: REMOTE_RUNTIME_URL' }))
    const offline = gateLockReason(status({ state: 'OFFLINE', configured: true, detail: 'Gateway respondeu HTTP 502.' }))
    expect(disabled).toContain('DESATIVADO')
    expect(misconfigured).toContain('CONFIGURAÇÃO INCOMPLETA')
    expect(misconfigured).toContain('REMOTE_RUNTIME_URL')
    expect(offline).toContain('OFFLINE')
    expect(offline).toContain('gateway não respondeu')
    expect(new Set([disabled, misconfigured, offline]).size).toBe(3)
    // Nunca revelar valores de credencial ou URLs concretas.
    for (const reason of [disabled, misconfigured, offline]) {
      expect(reason).not.toMatch(/bearer\s|https?:\/\//i)
    }
  })
})
