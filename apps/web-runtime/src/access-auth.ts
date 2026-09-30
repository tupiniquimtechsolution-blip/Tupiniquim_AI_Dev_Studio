export interface AccessAuthConfig {
  WEB_ALLOW_ANONYMOUS?: string
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
}

export interface AccessIdentity {
  kind: 'USER' | 'SERVICE'
  principal: string
  email: string | null
  sub: string | null
  commonName: string | null
  issuer: string
  audience: string[]
}

export type AccessAuthorization =
  | { allowed: true; anonymous: true; identity: null }
  | { allowed: true; anonymous: false; identity: AccessIdentity }
  | { allowed: false; status: 401 | 403 | 503; code: 'WEB_AUTH_REQUIRED' | 'WEB_AUTH_INVALID' | 'WEB_AUTH_MISCONFIGURED'; message: string }

export const accessAuthReadiness = (config: AccessAuthConfig): { state: 'ANONYMOUS_TEST' | 'ACCESS_READY' | 'MISCONFIGURED'; productionReady: boolean } => {
  if (config.WEB_ALLOW_ANONYMOUS === 'true') return { state: 'ANONYMOUS_TEST', productionReady: false }
  if (config.ACCESS_TEAM_DOMAIN?.trim() && config.ACCESS_AUD?.trim()) return { state: 'ACCESS_READY', productionReady: true }
  return { state: 'MISCONFIGURED', productionReady: false }
}

type AccessJwtHeader = { alg?: unknown; kid?: unknown }
type AccessJwtPayload = { iss?: unknown; aud?: unknown; exp?: unknown; nbf?: unknown; email?: unknown; sub?: unknown; common_name?: unknown }
type JwkWithKid = JsonWebKey & { kid?: string }
type JwksResponse = { keys?: JwkWithKid[] }

const jwksCache = new Map<string, { expiresAt: number; keys: JwkWithKid[] }>()
const JWKS_CACHE_MS = 5 * 60 * 1000

const decodeBase64Url = (value: string): Uint8Array<ArrayBuffer> => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

const decodeJsonPart = <T>(value: string): T => {
  const bytes = decodeBase64Url(value)
  return JSON.parse(new TextDecoder().decode(bytes)) as T
}

const normalizeIssuer = (value: string): string => {
  const candidate = value.includes('://') ? value : `https://${value}`
  const url = new URL(candidate)
  if (url.protocol !== 'https:') throw new Error('ACCESS_TEAM_DOMAIN deve usar HTTPS.')
  return url.origin
}

const configuredAudiences = (value: string): string[] =>
  value.split(',').map((item) => item.trim()).filter(Boolean)

const payloadAudiences = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const loadJwks = async (issuer: string, fetchImpl: typeof fetch): Promise<JwkWithKid[]> => {
  const cached = jwksCache.get(issuer)
  if (cached !== undefined && cached.expiresAt > Date.now()) return cached.keys

  const response = await fetchImpl(`${issuer}/cdn-cgi/access/certs`, {
    headers: { accept: 'application/json' }
  })
  if (!response.ok) throw new Error('Não foi possível obter as chaves públicas do Cloudflare Access.')
  const body = await response.json() as JwksResponse
  const keys = Array.isArray(body.keys) ? body.keys : []
  if (keys.length === 0) throw new Error('Cloudflare Access não retornou chaves públicas válidas.')
  jwksCache.set(issuer, { expiresAt: Date.now() + JWKS_CACHE_MS, keys })
  return keys
}

export const clearAccessJwksCacheForTests = (): void => {
  jwksCache.clear()
}

export const verifyAccessJwt = async (
  token: string,
  config: Pick<AccessAuthConfig, 'ACCESS_TEAM_DOMAIN' | 'ACCESS_AUD'>,
  fetchImpl: typeof fetch = fetch
): Promise<AccessIdentity> => {
  if (!config.ACCESS_TEAM_DOMAIN?.trim() || !config.ACCESS_AUD?.trim()) {
    throw new Error('Cloudflare Access não está configurado.')
  }

  const [encodedHeader, encodedPayload, encodedSignature, ...extra] = token.split('.')
  if (!encodedHeader || !encodedPayload || !encodedSignature || extra.length > 0) throw new Error('JWT Access inválido.')

  const header = decodeJsonPart<AccessJwtHeader>(encodedHeader)
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid === '') throw new Error('JWT Access usa algoritmo/chave não suportado.')

  const issuer = normalizeIssuer(config.ACCESS_TEAM_DOMAIN)
  const keys = await loadJwks(issuer, fetchImpl)
  const jwk = keys.find((candidate) => candidate.kid === header.kid)
  if (jwk === undefined) throw new Error('Chave pública do JWT Access não encontrada.')

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const signed = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  const signature = decodeBase64Url(encodedSignature)
  const signatureValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed)
  if (!signatureValid) throw new Error('Assinatura do JWT Access inválida.')

  const payload = decodeJsonPart<AccessJwtPayload>(encodedPayload)
  const now = Math.floor(Date.now() / 1000)
  if (payload.iss !== issuer) throw new Error('Issuer do JWT Access inválido.')
  if (typeof payload.exp !== 'number' || payload.exp <= now) throw new Error('JWT Access expirado.')
  if (typeof payload.nbf === 'number' && payload.nbf > now) throw new Error('JWT Access ainda não é válido.')

  const acceptedAudiences = configuredAudiences(config.ACCESS_AUD)
  const audiences = payloadAudiences(payload.aud)
  if (acceptedAudiences.length === 0 || !audiences.some((audience) => acceptedAudiences.includes(audience))) {
    throw new Error('Audience do JWT Access inválida.')
  }
  const email = typeof payload.email === 'string' && payload.email.trim() !== '' ? payload.email.trim().toLowerCase() : null
  const sub = typeof payload.sub === 'string' && payload.sub.trim() !== '' ? payload.sub.trim() : null
  const commonName = typeof payload.common_name === 'string' && payload.common_name.trim() !== '' ? payload.common_name.trim() : null

  if (sub !== null && email !== null) {
    return {
      kind: 'USER',
      principal: `user:${sub}`,
      email,
      sub,
      commonName,
      issuer,
      audience: audiences
    }
  }

  if (commonName !== null) {
    return {
      kind: 'SERVICE',
      principal: `service:${commonName}`,
      email,
      sub,
      commonName,
      issuer,
      audience: audiences
    }
  }

  throw new Error('JWT Access não contém principal de usuário nem service token.')
}

export const authorizeAccessRequest = async (
  request: Request,
  config: AccessAuthConfig,
  fetchImpl: typeof fetch = fetch
): Promise<AccessAuthorization> => {
  if (config.WEB_ALLOW_ANONYMOUS === 'true') return { allowed: true, anonymous: true, identity: null }

  if (!config.ACCESS_TEAM_DOMAIN?.trim() || !config.ACCESS_AUD?.trim()) {
    return {
      allowed: false,
      status: 503,
      code: 'WEB_AUTH_MISCONFIGURED',
      message: 'Cloudflare Access precisa de ACCESS_TEAM_DOMAIN e ACCESS_AUD.'
    }
  }

  const token = request.headers.get('cf-access-jwt-assertion')
  if (token === null || token.trim() === '') {
    return { allowed: false, status: 401, code: 'WEB_AUTH_REQUIRED', message: 'A edição Web requer autenticação Cloudflare Access.' }
  }

  try {
    return { allowed: true, anonymous: false, identity: await verifyAccessJwt(token, config, fetchImpl) }
  } catch {
    return { allowed: false, status: 403, code: 'WEB_AUTH_INVALID', message: 'A identidade Cloudflare Access não pôde ser validada.' }
  }
}

export const scopeWorkspaceId = async (identity: AccessIdentity, clientWorkspaceId: string): Promise<string> => {
  const source = `${identity.issuer}\n${identity.principal}\n${clientWorkspaceId}`
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
