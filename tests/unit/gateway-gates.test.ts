import { describe, expect, it, vi } from 'vitest'
import { executeGatewayGate } from '../../apps/runtime-gateway/src/gate-runner'

describe('Gateway gate evidence', () => {
  it('never certifies manual gates through keyword matches or a build', async () => {
    const execute = vi.fn()
    for (const gate of ['privacy-lgpd', 'accessibility-wcag', 'architecture-review', 'release-checklist', 'supply-chain']) {
      expect((await executeGatewayGate(gate, execute)).state).toBe('NOT_AVAILABLE')
    }
    expect(execute).not.toHaveBeenCalled()
  })
  it('omits all scan and command output, including when the scanner errors', async () => {
    for (const code of [0, 1, 2]) {
      const execute = vi.fn().mockResolvedValue({ code, stdout: 'private fixture data', stderr: 'sensitive diagnostic' })
      const result = await executeGatewayGate('secret-scan', execute)
      expect(result.state).toBe(code === 1 ? 'PASS' : 'FAIL')
      expect(result.evidence).not.toContain('private fixture')
      expect(result.evidence).not.toContain('sensitive diagnostic')
      expect(execute.mock.calls[0]?.[1]).toContain('-qE')
    }
  })
  it('runs the full quality sequence and stops at the actual failure', async () => {
    const executed: string[] = []
    const result = await executeGatewayGate('quality-gates', (_bin, args) => {
      executed.push(args[0] ?? '')
      return Promise.resolve({ code: args[0] === 'test:integration' ? 1 : 0, stdout: 'private fixture data', stderr: '' })
    })
    expect(executed).toEqual(['lint', 'typecheck', 'test:unit', 'test:integration'])
    expect(result.state).toBe('FAIL')
    expect(result.evidence).toContain('test:integration: exit 1')
    expect(result.evidence).not.toContain('private fixture')
  })
})
