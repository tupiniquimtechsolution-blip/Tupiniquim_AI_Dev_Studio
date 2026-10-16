import { describe, expect, it } from 'vitest'
import { authorizeToolboxGateExecution, evaluateToolboxGateAvailability, getToolboxGate, toolboxGateCatalog } from './toolbox-gates'

describe('Toolbox gates', () => {
  it('expõe o catálogo canônico de boas práticas', () => {
    expect(toolboxGateCatalog.map((gate) => gate.id)).toEqual([
      'quality-gates', 'dependency-audit', 'secret-scan', 'security-review', 'privacy-lgpd',
      'accessibility-wcag', 'architecture-review', 'supply-chain', 'release-checklist'
    ])
  })

  it('não converte ambiente ausente em PASS', () => {
    expect(evaluateToolboxGateAvailability({ gateId: 'quality-gates', environmentAvailable: false, networkAvailable: true, executed: false }).state).toBe('NOT_AVAILABLE')
  })

  it('marca dependência de rede como NOT_AVAILABLE quando offline', () => {
    expect(evaluateToolboxGateAvailability({ gateId: 'dependency-audit', environmentAvailable: true, networkAvailable: false, executed: false }).state).toBe('NOT_AVAILABLE')
  })

  it('distingue SKIPPED, FAIL e PASS', () => {
    expect(evaluateToolboxGateAvailability({ gateId: 'security-review', environmentAvailable: true, networkAvailable: true, executed: false }).state).toBe('SKIPPED')
    expect(evaluateToolboxGateAvailability({ gateId: 'security-review', environmentAvailable: true, networkAvailable: true, executed: true, passed: false }).state).toBe('FAIL')
    expect(evaluateToolboxGateAvailability({ gateId: 'security-review', environmentAvailable: true, networkAvailable: true, executed: true, passed: true }).state).toBe('PASS')
  })

  it('mantém comandos declarativos e auditáveis', () => {
    expect(getToolboxGate('quality-gates').command).toContain('pnpm lint')
    expect(getToolboxGate('security-review').command).toBe('pnpm test:security')
  })

  it('não inventa autorização adicional', () => {
    expect(authorizeToolboxGateExecution('security-review', false).id).toBe('security-review')
  })
})
