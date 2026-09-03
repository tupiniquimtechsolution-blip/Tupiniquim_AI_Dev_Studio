import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { researchResultSchema, researchSourceSchema, type ResearchResult, type ResearchSource } from '@tupiniquim/contracts'
import { assertPublicResearchUrl, fetchPublicResearch } from './research-network-security'

const injectionPatterns: Array<[RegExp, string]> = [
  [/ignore (?:all |any )?(?:previous|prior) instructions/iu, 'IGNORE_PREVIOUS_INSTRUCTIONS'],
  [/(?:system|developer) prompt/iu, 'PROMPT_REFERENCE'],
  [/(?:exfiltrate|reveal|print).{0,40}(?:secret|token|api key)/iu, 'SECRET_EXFILTRATION_LANGUAGE']
]

const decodeHtml = (value: string): string => value
  .replace(/<[^>]+>/gu, ' ')
  .replace(/&amp;/gu, '&')
  .replace(/&quot;/gu, '"')
  .replace(/&#x27;|&#39;/gu, "'")
  .replace(/&lt;/gu, '<')
  .replace(/&gt;/gu, '>')
  .replace(/\s+/gu, ' ')
  .trim()

const assertPublicUrl = assertPublicResearchUrl
const fetchPublic = fetchPublicResearch

const promptSignals = (content: string): string[] => injectionPatterns.filter(([pattern]) => pattern.test(content)).map(([, signal]) => signal)

const unwrapDuckDuckGoUrl = (rawUrl: string): string => {
  const absolute = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl
  try {
    const url = new URL(absolute, 'https://duckduckgo.com')
    const redirected = url.searchParams.get('uddg')
    return assertPublicUrl(redirected ?? url.toString()).toString()
  } catch { return 'https://duckduckgo.com/' }
}

export class HttpResearchProvider {
  private readonly cacheRoot: string

  public constructor(dataRoot: string) { this.cacheRoot = path.join(dataRoot, 'research', 'cache') }

  public async search(query: string, maxResults = 8): Promise<ResearchResult> {
    const key = createHash('sha256').update(`search:${query}:${maxResults}`).digest('hex')
    const cached = await this.readCache(key)
    if (cached !== null) return researchResultSchema.parse({ ...cached, cached: true })
    const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const response = await fetchPublic(endpoint, 'text/html')
    if (!response.ok) throw new Error(`Pesquisa HTTP falhou com status ${response.status}.`)
    const html = (await response.text()).slice(0, 2_000_000)
    const linkPattern = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/giu
    const snippetPattern = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/giu
    const snippets = [...html.matchAll(snippetPattern)].map((match) => decodeHtml(match[1] ?? match[2] ?? ''))
    const sources: ResearchSource[] = []
    let index = 0
    for (const match of html.matchAll(linkPattern)) {
      if (sources.length >= maxResults) break
      const title = decodeHtml(match[2] ?? '')
      const url = unwrapDuckDuckGoUrl(match[1] ?? '')
      if (title === '' || url === 'https://duckduckgo.com/') continue
      const snippet = snippets[index] ?? ''
      index += 1
      sources.push(researchSourceSchema.parse({ id: randomUUID(), url, title, snippet, retrievedAt: new Date().toISOString(), origin: 'SEARCH', trust: 'EXTERNAL_UNTRUSTED', license: 'UNKNOWN', promptInjectionSignals: promptSignals(`${title}\n${snippet}`) }))
    }
    const result = researchResultSchema.parse({ query, sources, cached: false })
    await this.writeCache(key, result)
    return result
  }

  public async collect(rawUrl: string): Promise<ResearchSource> {
    const url = assertPublicUrl(rawUrl)
    await this.assertRobotsAllowed(url)
    const response = await fetchPublic(url.toString(), 'text/html,text/plain,application/json')
    if (!response.ok) throw new Error(`Coleta HTTP falhou com status ${response.status}.`)
    const contentLength = Number(response.headers.get('content-length') ?? 0)
    if (contentLength > 2_000_000) throw new Error('Documento excede o limite de 2 MB.')
    const raw = (await response.text()).slice(0, 2_000_000)
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/iu.exec(raw)
    const title = decodeHtml(titleMatch?.[1] ?? url.hostname)
    const text = decodeHtml(raw).slice(0, 20_000)
    return researchSourceSchema.parse({ id: randomUUID(), url: url.toString(), title, snippet: text, retrievedAt: new Date().toISOString(), origin: 'DIRECT', trust: 'EXTERNAL_UNTRUSTED', license: 'UNKNOWN', promptInjectionSignals: promptSignals(text) })
  }

  private async assertRobotsAllowed(url: URL): Promise<void> {
    try {
      const response = await fetchPublic(new URL('/robots.txt', url.origin).toString(), 'text/plain')
      if (!response.ok) return
      const lines = (await response.text()).split(/\r?\n/u)
      let applies = false
      for (const line of lines) {
        const [rawKey, ...rawValue] = line.split(':')
        const key = rawKey?.trim().toLowerCase()
        const value = rawValue.join(':').trim()
        if (key === 'user-agent') applies = value === '*'
        if (applies && key === 'disallow' && value !== '' && url.pathname.startsWith(value)) throw new Error('Coleta bloqueada por robots.txt.')
      }
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'Coleta bloqueada por robots.txt.') throw cause
    }
  }

  private async readCache(key: string): Promise<ResearchResult | null> {
    try {
      const parsed = researchResultSchema.parse(JSON.parse(await readFile(path.join(this.cacheRoot, `${key}.json`), 'utf8')))
      const age = Date.now() - new Date(parsed.sources[0]?.retrievedAt ?? 0).getTime()
      return age <= 24 * 60 * 60 * 1_000 ? parsed : null
    } catch { return null }
  }

  private async writeCache(key: string, value: ResearchResult): Promise<void> {
    await mkdir(this.cacheRoot, { recursive: true })
    const target = path.join(this.cacheRoot, `${key}.json`)
    const temporary = `${target}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify(value), { encoding: 'utf8', flag: 'wx' })
    await rename(temporary, target)
  }
}
