import { lookup } from 'node:dns/promises'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP } from 'node:net'

const MAX_RESPONSE_BYTES = 2_000_000
const REQUEST_TIMEOUT_MS = 15_000

export interface ResearchResolvedAddress {
  address: string
  family: 4 | 6
}

export type ResearchHostResolver = (
  hostname: string
) => Promise<Array<{ address: string }>>

const blockedIpv4Addresses = new BlockList()
const blockedIpv6Addresses = new BlockList()

const blockedIpv4Subnets: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
]

const blockedIpv6Subnets: Array<[string, number]> = [
  ['::', 128],
  ['::1', 128],
  ['::ffff:0:0', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
  ['2002::', 16]
]

for (const [address, prefix] of blockedIpv4Subnets) {
  blockedIpv4Addresses.addSubnet(address, prefix, 'ipv4')
}

for (const [address, prefix] of blockedIpv6Subnets) {
  blockedIpv6Addresses.addSubnet(address, prefix, 'ipv6')
}

const normalizeHostname = (rawHostname: string): string => {
  let hostname = rawHostname.toLowerCase()

  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1)
  }

  if (hostname.endsWith('.')) hostname = hostname.slice(0, -1)

  return hostname
}

const assertPublicAddress = (address: string): ResearchResolvedAddress => {
  const family = isIP(address)

  if (family !== 4 && family !== 6) {
    throw new Error('SSRF: endereco IP invalido.')
  }

  const blocked =
    family === 6
      ? blockedIpv6Addresses.check(address, 'ipv6')
      : blockedIpv4Addresses.check(address, 'ipv4')

  if (blocked) {
    throw new Error('SSRF: destino privado, local ou reservado bloqueado.')
  }

  return { address, family }
}

const defaultResolver: ResearchHostResolver = async (hostname) => {
  const addresses = await lookup(hostname, {
    all: true,
    verbatim: true
  })

  return addresses.map(({ address }) => ({ address }))
}

export const assertPublicResearchUrl = (rawUrl: string): URL => {
  const url = new URL(rawUrl)

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Somente HTTP/HTTPS e permitido na pesquisa.')
  }

  if (url.username !== '' || url.password !== '') {
    throw new Error('URLs com credenciais sao proibidas.')
  }

  const hostname = normalizeHostname(url.hostname)

  const localName =
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === 'local' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.home') ||
    hostname.endsWith('.home.arpa')

  if (localName) {
    throw new Error('SSRF: destino privado/local bloqueado.')
  }

  const literalFamily = isIP(hostname)

  if (literalFamily === 4 || literalFamily === 6) {
    assertPublicAddress(hostname)
  } else if (!hostname.includes('.')) {
    throw new Error('SSRF: hostname local ou nao publico bloqueado.')
  }

  return url
}

export const resolvePublicResearchTarget = async (
  rawHostname: string,
  resolver: ResearchHostResolver = defaultResolver
): Promise<ResearchResolvedAddress> => {
  const hostname = normalizeHostname(rawHostname)
  const literalFamily = isIP(hostname)

  if (literalFamily === 4 || literalFamily === 6) {
    return assertPublicAddress(hostname)
  }

  const addresses = await resolver(hostname)

  if (addresses.length === 0) {
    throw new Error('DNS nao retornou enderecos para o destino.')
  }

  const validated: ResearchResolvedAddress[] = []

  for (const { address } of addresses) {
    validated.push(assertPublicAddress(address))
  }

  const selected = validated[0]

  if (selected === undefined) {
    throw new Error('DNS nao retornou destino utilizavel.')
  }

  return selected
}

const responseFromIncomingMessage = async (
  response: IncomingMessage
): Promise<Response> => await new Promise((resolve, reject) => {
  const chunks: Buffer[] = []
  let totalBytes = 0
  let settled = false

  const fail = (cause: unknown): void => {
    if (settled) return
    settled = true
    reject(cause instanceof Error ? cause : new Error(String(cause)))
  }

  const declaredLength = Number(response.headers['content-length'] ?? 0)

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_RESPONSE_BYTES
  ) {
    response.destroy()
    fail(new Error('Documento excede o limite de 2 MB.'))
    return
  }

  response.on('data', (chunk: Buffer) => {
    if (settled) return

    totalBytes += chunk.byteLength

    if (totalBytes > MAX_RESPONSE_BYTES) {
      response.destroy()
      fail(new Error('Documento excede o limite de 2 MB.'))
      return
    }

    chunks.push(chunk)
  })

  response.once('aborted', () => {
    fail(new Error('Resposta HTTP interrompida.'))
  })

  response.once('error', fail)

  response.once('end', () => {
    if (settled) return

    const responseHeaders = new Headers()

    for (const [name, value] of Object.entries(response.headers)) {
      if (value === undefined) continue

      if (Array.isArray(value)) {
        for (const item of value) responseHeaders.append(name, item)
      } else {
        responseHeaders.set(name, value)
      }
    }

    const status = response.statusCode ?? 500
    const bodyForbidden =
      status === 204 ||
      status === 205 ||
      status === 304

    const body = bodyForbidden
      ? null
      : Buffer.concat(chunks).toString('utf8')

    const init: ResponseInit = {
      status,
      headers: responseHeaders
    }

    if (response.statusMessage !== undefined) {
      init.statusText = response.statusMessage
    }

    settled = true
    resolve(new Response(body, init))
  })
})

const requestValidatedTarget = async (
  url: URL,
  accept: string
): Promise<Response> => {
  const hostname = normalizeHostname(url.hostname)
  const resolved = await resolvePublicResearchTarget(hostname)

  const requestOptions = {
    hostname: resolved.address,
    port:
      url.port === ''
        ? url.protocol === 'https:'
          ? 443
          : 80
        : Number(url.port),
    path: `${url.pathname}${url.search}`,
    method: 'GET',
    headers: {
      accept,
      host: url.host,
      'user-agent': 'Tupiniquim-AI-Dev-Studio/0.1 (+local-first research)'
    }
  }

  return await new Promise<Response>((resolve, reject) => {
    const handleResponse = (response: IncomingMessage): void => {
      void responseFromIncomingMessage(response).then(resolve, reject)
    }

    const request =
      url.protocol === 'https:'
        ? httpsRequest(
            isIP(hostname) === 0
              ? { ...requestOptions, servername: hostname }
              : requestOptions,
            handleResponse
          )
        : httpRequest(requestOptions, handleResponse)

    const timer = setTimeout(() => {
      request.destroy(new Error('Timeout da pesquisa HTTP.'))
    }, REQUEST_TIMEOUT_MS)

    request.once('error', reject)

    request.once('close', () => {
      clearTimeout(timer)
    })

    request.end()
  })
}

export const fetchPublicResearch = async (
  rawUrl: string,
  accept: string
): Promise<Response> => {
  let current = assertPublicResearchUrl(rawUrl)

  for (let redirect = 0; redirect < 5; redirect += 1) {
    const response = await requestValidatedTarget(current, accept)

    if (response.status < 300 || response.status >= 400) {
      return response
    }

    const location = response.headers.get('location')

    if (location === null) return response

    current = assertPublicResearchUrl(
      new URL(location, current).toString()
    )
  }

  throw new Error('Limite de redirecionamentos excedido.')
}
