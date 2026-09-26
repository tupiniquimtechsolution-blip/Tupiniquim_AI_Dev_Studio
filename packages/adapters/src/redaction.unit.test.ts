import { describe, expect, it } from 'vitest'
import { redactUntrustedOutput } from './redaction'

describe('redactUntrustedOutput', () => {
  it('remove formatos comuns de credencial sem depender do provider', () => {
    const value = [
      'sk-proj-1234567890abcdefghijklmnop',
      'authorization: Bearer-secret-value',
      'api_key=super-secret-key',
      'password=hunter2',
      'ghp_123456789012345678901234567890123456',
      'AIza12345678901234567890123456789012345',
      'eyJabcdefghijk.abcdefghijklmnop.abcdefghijklmnop'
    ].join('\n')

    const redacted = redactUntrustedOutput(value)

    expect(redacted).not.toContain('hunter2')
    expect(redacted).not.toContain('super-secret-key')
    expect(redacted).not.toContain('ghp_')
    expect(redacted).not.toContain('AIza')
    expect(redacted).not.toContain('eyJabcdefghijk')
    expect(redacted.match(/\[REDACTED\]/gu)?.length).toBeGreaterThanOrEqual(6)
  })

  it('limita saída não confiável', () => {
    expect(redactUntrustedOutput('x'.repeat(10_000), 512)).toHaveLength(512)
  })
})
