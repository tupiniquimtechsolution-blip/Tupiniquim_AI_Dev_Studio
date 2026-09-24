export type KnowledgeIngestionDecision =
  | { eligible: true; reason: 'ELIGIBLE_SOURCE' }
  | { eligible: false; reason: 'SENSITIVE_PATH' | 'GENERATED_ARTIFACT' | 'VCS_INTERNAL' }

const generatedSegments = new Set([
  'node_modules',
  '.cache',
  'out',
  'release',
  'coverage',
  'playwright-report',
  'test-results',
  '.wrangler',
  '.wrangler-dry-run'
])

const isSensitiveName = (name: string): boolean => {
  const lower = name.toLowerCase()
  if (lower === '.env' || lower.startsWith('.env.')) return true
  return /(?:^|[-_.])(secret|secrets|credential|credentials|token|tokens|apikey|api-key)(?:$|[-_.])/u.test(lower)
}

export const assessKnowledgeIngestionPath = (rawPath: string): KnowledgeIngestionDecision => {
  const normalized = rawPath.replace(/\\/gu, '/').replace(/^\.\//u, '')
  const segments = normalized.split('/').filter(Boolean)

  if (segments.some((segment) => segment === '.git')) return { eligible: false, reason: 'VCS_INTERNAL' }
  if (segments.some((segment) => generatedSegments.has(segment))) return { eligible: false, reason: 'GENERATED_ARTIFACT' }
  if (segments.some(isSensitiveName)) return { eligible: false, reason: 'SENSITIVE_PATH' }
  return { eligible: true, reason: 'ELIGIBLE_SOURCE' }
}

export const assertKnowledgeIngestionPath = (rawPath: string): void => {
  const decision = assessKnowledgeIngestionPath(rawPath)
  if (!decision.eligible) throw new Error(`Knowledge auto-ingestion bloqueada: ${decision.reason}.`)
}
