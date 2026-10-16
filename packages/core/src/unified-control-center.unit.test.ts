import { describe, expect, it } from 'vitest'
import { canRunUnifiedControlItem, normalizeUnifiedGateState, parseUnifiedControlCenterManifest } from './unified-control-center'

const manifest = {
  schemaVersion: 1,
  product: 'Tupiniquim Dev AI',
  surface: 'Tupiniquim Control Center',
  principles: {
    explicitProviderSelection: true,
    explicitModelSelection: true,
    automaticFallback: false,
    discoveryImpliesApproval: false,
    privilegedActionsDefaultDeny: true,
    missingEnvironmentCanPass: false
  },
  sections: [
    { id: 'models-providers', label: 'Modelos & Providers', items: [{ id: 'provider-status', label: 'Status', mode: 'read' }] },
    { id: 'skills', label: 'Skills', items: [{ id: 'skill-enable', label: 'Habilitar', mode: 'approval-required' }] },
    { id: 'toolbox', label: 'Toolbox', items: [{ id: 'security-review', label: 'Segurança', mode: 'controlled-action' }] },
    { id: 'ai-lab', label: 'AI Lab', items: [{ id: 'runtime-detect', label: 'Detectar runtimes', mode: 'read' }] },
    { id: 'agents', label: 'Agentes', items: [{ id: 'agent-registry', label: 'Agent Registry', mode: 'read' }] },
    { id: 'security-quality', label: 'Segurança & Qualidade', items: [{ id: 'run-gates', label: 'Executar gates', mode: 'controlled-action' }] }
  ],
  runtimeLayout: {
    directories: ['runtime', 'models', 'data', 'projects', 'cache'],
    portableRootDetection: true,
    allowExternalWritesByDefault: false
  },
  gateStates: ['PASS', 'FAIL', 'SKIPPED', 'NOT_AVAILABLE']
}

describe('Unified Control Center', () => {
  it('aceita o manifesto seguro e completo', () => {
    const parsed = parseUnifiedControlCenterManifest(manifest)
    expect(parsed.sections.map((section) => section.id)).toEqual([
      'models-providers', 'skills', 'toolbox', 'ai-lab', 'agents', 'security-quality'
    ])
  })

  it('rejeita fallback automático', () => {
    expect(() => parseUnifiedControlCenterManifest({
      ...manifest,
      principles: { ...manifest.principles, automaticFallback: true }
    })).toThrow(/fallback/i)
  })

  it('rejeita skill descoberta como automaticamente aprovada', () => {
    expect(() => parseUnifiedControlCenterManifest({
      ...manifest,
      principles: { ...manifest.principles, discoveryImpliesApproval: true }
    })).toThrow(/discovery/i)
  })

  it('exige aprovação para ações approval-required', () => {
    expect(canRunUnifiedControlItem({ id: 'skill-enable', label: 'Habilitar', mode: 'approval-required' }, false)).toBe(false)
    expect(canRunUnifiedControlItem({ id: 'skill-enable', label: 'Habilitar', mode: 'approval-required' }, true)).toBe(true)
  })

  it('nunca converte ambiente ausente em PASS', () => {
    expect(normalizeUnifiedGateState({ available: false, executed: false })).toBe('NOT_AVAILABLE')
    expect(normalizeUnifiedGateState({ available: true, executed: false })).toBe('SKIPPED')
    expect(normalizeUnifiedGateState({ available: true, executed: true, passed: false })).toBe('FAIL')
    expect(normalizeUnifiedGateState({ available: true, executed: true, passed: true })).toBe('PASS')
  })
})
