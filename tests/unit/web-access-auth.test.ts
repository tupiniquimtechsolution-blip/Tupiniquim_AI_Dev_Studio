import { afterEach, describe, expect, it } from 'vitest'
import {
  authorizeAccessRequest,
  clearAccessJwksCacheForTests,
  scopeWorkspaceId,
  verifyAccessJwt
} from '../../apps/web-runtime/src/access-auth'

const encodeBase64Url = (value: Uint8Array): string => {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const jsonPart = (value: unknown): string =>
  encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)))

const signedJwt = async (input: { audience: string; issuer: string; email?: string }): Promise<{ token: string; jwk: JsonWebKey & { kid: string } }> => {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  )
  const kid = 'test-key'
  const header = jsonPart({ alg: 'RS256', kid, typ: 'JWT' })
  const payload = jsonPart({
    iss: input.issuer,
    aud: input.audience,
    exp: Math.floor(Date.now() / 1000) + 300,
    iat: Math.floor(Date.now() / 1000),
    email: input.email ?? 'dev@example.com',
    sub: 'user-123'
  })
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(`${header}.${payload}`))
  const exported = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  return { token: `${header}.${payload}.${encodeBase64Url(new Uint8Array(signature))}`, jwk: { ...exported, kid } }
}

afterEach(() => clearAccessJwksCacheForTests())

describe('Cloudflare Access JWT auth', () => {
  it('permite modo anônimo somente quando explicitamente habilitado', async () => {
    const result = await authorizeAccessRequest(new Request('https://app.example/api/studio'), { WEB_ALLOW_ANONYMOUS: 'true' })
    expect(result).toEqual({ allowed: true, anonymous: true, identity: null })
  })

  it('não confia no header de email sem JWT validado', async () => {
    const request = new Request('https://app.example/api/studio', { headers: { 'cf-access-authenticated-user-email': 'spoof@example.com' } })
    const result = await authorizeAccessRequest(request, {
      WEB_ALLOW_ANONYMOUS: 'false',
      ACCESS_TEAM_DOMAIN: 'https://team.cloudflareaccess.com',
      ACCESS_AUD: 'app-aud'
    })
    expect(result).toMatchObject({ allowed: false, status: 401, code: 'WEB_AUTH_REQUIRED' })
  })

  it('falha fechado quando Access está habilitado mas sem issuer/audience', async () => {
    const result = await authorizeAccessRequest(new Request('https://app.example/api/studio'), { WEB_ALLOW_ANONYMOUS: 'false' })
    expect(result).toMatchObject({ allowed: false, status: 503, code: 'WEB_AUTH_MISCONFIGURED' })
  })

  it('valida assinatura, issuer, audience, exp e identidade', async () => {
    const issuer = 'https://team.cloudflareaccess.com'
    const { token, jwk } = await signedJwt({ audience: 'app-aud', issuer })
    const mockFetch = async (): Promise<Response> => Response.json({ keys: [jwk] })
    const identity = await verifyAccessJwt(token, { ACCESS_TEAM_DOMAIN: issuer, ACCESS_AUD: 'app-aud' }, mockFetch as typeof fetch)
    expect(identity).toMatchObject({ email: 'dev@example.com', sub: 'user-123', issuer, audience: ['app-aud'] })
  })

  it('rejeita audience diferente mesmo com assinatura válida', async () => {
    const issuer = 'https://team.cloudflareaccess.com'
    const { token, jwk } = await signedJwt({ audience: 'wrong-aud', issuer })
    const mockFetch = async (): Promise<Response> => Response.json({ keys: [jwk] })
    await expect(verifyAccessJwt(token, { ACCESS_TEAM_DOMAIN: issuer, ACCESS_AUD: 'expected-aud' }, mockFetch as typeof fetch)).rejects.toThrow(/Audience/)
  })

  it('isola o mesmo workspace client-side entre identidades diferentes', async () => {
    const common = { issuer: 'https://team.cloudflareaccess.com', audience: ['app-aud'] }
    const a = await scopeWorkspaceId({ ...common, email: 'a@example.com', sub: 'a' }, 'workspace-local')
    const b = await scopeWorkspaceId({ ...common, email: 'b@example.com', sub: 'b' }, 'workspace-local')
    expect(a).toMatch(/^[a-f0-9]{64}$/)
    expect(a).not.toBe(b)
    expect(await scopeWorkspaceId({ ...common, email: 'a@example.com', sub: 'a' }, 'workspace-local')).toBe(a)
  })
})
