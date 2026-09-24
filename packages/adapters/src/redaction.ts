const patterns: Array<[RegExp, string]> = [
  [/sk-(?:proj-)?[A-Za-z0-9_-]{12,}/gu, '[REDACTED]'],
  [/(?:gh[pousr]_[A-Za-z0-9_]{20,})/gu, '[REDACTED]'],
  [/(?:AIza[0-9A-Za-z_-]{20,})/gu, '[REDACTED]'],
  [/(?:eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/gu, '[REDACTED]'],
  [/(authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|password|secret)\s*[:=]\s*[^\s,;]+/giu, '$1=[REDACTED]']
]

export const redactUntrustedOutput = (value: string, maxLength = 4_000): string => {
  let redacted = value
  for (const [pattern, replacement] of patterns) redacted = redacted.replace(pattern, replacement)
  return redacted.slice(0, Math.max(0, maxLength))
}
