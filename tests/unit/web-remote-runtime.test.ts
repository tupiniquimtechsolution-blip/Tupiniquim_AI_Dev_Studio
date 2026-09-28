import { describe, expect, it } from 'vitest'
import { remoteRuntimeReadiness } from '../../apps/web-runtime/src/remote-runtime'

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
    expect(remoteRuntimeReadiness({
      WEB_REMOTE_RUNTIME_ENABLED: 'true',
      REMOTE_RUNTIME_URL: 'https://runtime.example.com',
      REMOTE_RUNTIME_TOKEN: 'x'.repeat(32)
    })).toMatchObject({ state: 'OFFLINE', configured: true, online: false, transport: 'https-tunnel' })
  })
})
