export type UnifiedControlActionMode = 'read' | 'read-network' | 'explicit-action' | 'controlled-action' | 'approval-required'

export type UnifiedGateState = 'PASS' | 'FAIL' | 'SKIPPED' | 'NOT_AVAILABLE'

export interface UnifiedControlItem {
  id: string
  label: string
  mode: UnifiedControlActionMode
}

export interface UnifiedControlSection {
  id: string
  label: string
  items: UnifiedControlItem[]
}

export interface UnifiedControlCenterManifest {
  schemaVersion: 1
  product: 'Tupiniquim Dev AI'
  surface: 'Tupiniquim Control Center'
  principles: {
    explicitProviderSelection: true
    explicitModelSelection: true
    automaticFallback: false
    discoveryImpliesApproval: false
    privilegedActionsDefaultDeny: true
    missingEnvironmentCanPass: false
  }
  sections: UnifiedControlSection[]
  runtimeLayout: {
    directories: string[]
    portableRootDetection: boolean
    allowExternalWritesByDefault: boolean
  }
  gateStates: UnifiedGateState[]
}

const requiredSections = ['models-providers', 'skills', 'toolbox', 'ai-lab', 'agents', 'security-quality'] as const
const requiredRuntimeDirectories = ['runtime', 'models', 'data', 'projects', 'cache'] as const

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export const parseUnifiedControlCenterManifest = (input: unknown): UnifiedControlCenterManifest => {
  if (!isRecord(input)) throw new Error('Unified Control Center manifest must be an object.')
  if (input.schemaVersion !== 1) throw new Error('Unsupported Unified Control Center schemaVersion.')
  if (input.product !== 'Tupiniquim Dev AI' || input.surface !== 'Tupiniquim Control Center') {
    throw new Error('Unified Control Center product identity is invalid.')
  }
  if (!isRecord(input.principles)) throw new Error('Unified Control Center principles are required.')

  const principles = input.principles
  if (principles.explicitProviderSelection !== true || principles.explicitModelSelection !== true) {
    throw new Error('Provider and model selection must remain explicit.')
  }
  if (principles.automaticFallback !== false) throw new Error('Automatic provider/model fallback is forbidden.')
  if (principles.discoveryImpliesApproval !== false) throw new Error('Skill discovery must never imply approval.')
  if (principles.privilegedActionsDefaultDeny !== true) throw new Error('Privileged actions must remain default-deny.')
  if (principles.missingEnvironmentCanPass !== false) throw new Error('Missing environments must never be reported as PASS.')

  if (!Array.isArray(input.sections)) throw new Error('Unified Control Center sections are required.')
  const sections = input.sections.map((section): UnifiedControlSection => {
    if (!isRecord(section) || typeof section.id !== 'string' || typeof section.label !== 'string' || !Array.isArray(section.items)) {
      throw new Error('Unified Control Center section is invalid.')
    }
    return {
      id: section.id,
      label: section.label,
      items: section.items.map((item): UnifiedControlItem => {
        if (!isRecord(item) || typeof item.id !== 'string' || typeof item.label !== 'string') throw new Error(`Invalid item in section ${section.id}.`)
        const mode = item.mode
        if (!['read', 'read-network', 'explicit-action', 'controlled-action', 'approval-required'].includes(String(mode))) {
          throw new Error(`Invalid action mode in section ${section.id}.`)
        }
        return { id: item.id, label: item.label, mode: mode as UnifiedControlActionMode }
      })
    }
  })

  const sectionIds = new Set(sections.map((section) => section.id))
  for (const id of requiredSections) if (!sectionIds.has(id)) throw new Error(`Required Control Center section missing: ${id}.`)

  if (!isRecord(input.runtimeLayout) || !Array.isArray(input.runtimeLayout.directories)) throw new Error('Portable runtime layout is required.')
  const directories = input.runtimeLayout.directories.map(String)
  for (const directory of requiredRuntimeDirectories) if (!directories.includes(directory)) throw new Error(`Portable runtime directory missing: ${directory}.`)
  if (input.runtimeLayout.portableRootDetection !== true) throw new Error('Portable root detection must remain enabled.')
  if (input.runtimeLayout.allowExternalWritesByDefault !== false) throw new Error('External writes must remain disabled by default.')

  if (!Array.isArray(input.gateStates)) throw new Error('Gate states are required.')
  const gateStates = input.gateStates.map(String)
  for (const state of ['PASS', 'FAIL', 'SKIPPED', 'NOT_AVAILABLE']) if (!gateStates.includes(state)) throw new Error(`Gate state missing: ${state}.`)

  return {
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
    sections,
    runtimeLayout: {
      directories,
      portableRootDetection: true,
      allowExternalWritesByDefault: false
    },
    gateStates: gateStates as UnifiedGateState[]
  }
}

export const canRunUnifiedControlItem = (item: UnifiedControlItem, approved: boolean): boolean => {
  if (item.mode === 'approval-required') return approved
  return true
}

export const normalizeUnifiedGateState = (input: { available: boolean; executed: boolean; passed?: boolean }): UnifiedGateState => {
  if (!input.available) return 'NOT_AVAILABLE'
  if (!input.executed) return 'SKIPPED'
  return input.passed === true ? 'PASS' : 'FAIL'
}
