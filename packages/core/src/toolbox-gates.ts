import type { UnifiedGateState } from './unified-control-center'

export type ToolboxGateId =
  | 'quality-gates'
  | 'dependency-audit'
  | 'secret-scan'
  | 'security-review'
  | 'privacy-lgpd'
  | 'accessibility-wcag'
  | 'architecture-review'
  | 'supply-chain'
  | 'release-checklist'

export interface ToolboxGateDefinition {
  id: ToolboxGateId
  label: string
  command: string | null
  requiresNetwork: boolean
  mutatesWorkspace: boolean
  requiresApproval: boolean
}

export interface ToolboxGateEvidence {
  gateId: ToolboxGateId
  state: UnifiedGateState
  command: string | null
  reason: string
}

export const toolboxGateCatalog: readonly ToolboxGateDefinition[] = [
  { id: 'quality-gates', label: 'Lint / Typecheck / Test / Build', command: 'pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm test:security && pnpm build', requiresNetwork: false, mutatesWorkspace: false, requiresApproval: false },
  { id: 'dependency-audit', label: 'Auditoria de dependências', command: 'pnpm audit --prod', requiresNetwork: true, mutatesWorkspace: false, requiresApproval: false },
  { id: 'secret-scan', label: 'Secret scan', command: null, requiresNetwork: false, mutatesWorkspace: false, requiresApproval: false },
  { id: 'security-review', label: 'Verificação de segurança', command: 'pnpm test:security', requiresNetwork: false, mutatesWorkspace: false, requiresApproval: false },
  { id: 'privacy-lgpd', label: 'LGPD / Privacidade', command: null, requiresNetwork: false, mutatesWorkspace: false, requiresApproval: false },
  { id: 'accessibility-wcag', label: 'WCAG / Acessibilidade', command: null, requiresNetwork: false, mutatesWorkspace: false, requiresApproval: false },
  { id: 'architecture-review', label: 'Revisão de arquitetura', command: null, requiresNetwork: false, mutatesWorkspace: false, requiresApproval: false },
  { id: 'supply-chain', label: 'Supply chain', command: 'pnpm install --frozen-lockfile', requiresNetwork: false, mutatesWorkspace: false, requiresApproval: false },
  { id: 'release-checklist', label: 'Checklist de release', command: null, requiresNetwork: false, mutatesWorkspace: false, requiresApproval: false }
]

export const getToolboxGate = (id: ToolboxGateId): ToolboxGateDefinition => {
  const gate = toolboxGateCatalog.find((candidate) => candidate.id === id)
  if (gate === undefined) throw new Error(`Unknown Toolbox gate: ${id}`)
  return gate
}

export const evaluateToolboxGateAvailability = (input: {
  gateId: ToolboxGateId
  environmentAvailable: boolean
  networkAvailable: boolean
  executed: boolean
  passed?: boolean
}): ToolboxGateEvidence => {
  const gate = getToolboxGate(input.gateId)
  if (!input.environmentAvailable) return { gateId: gate.id, state: 'NOT_AVAILABLE', command: gate.command, reason: 'Required environment is not available.' }
  if (gate.requiresNetwork && !input.networkAvailable) return { gateId: gate.id, state: 'NOT_AVAILABLE', command: gate.command, reason: 'Network is required but not available.' }
  if (!input.executed) return { gateId: gate.id, state: 'SKIPPED', command: gate.command, reason: 'Gate was not executed.' }
  return { gateId: gate.id, state: input.passed === true ? 'PASS' : 'FAIL', command: gate.command, reason: input.passed === true ? 'Gate completed successfully.' : 'Gate failed; inspect evidence.' }
}

export const authorizeToolboxGateExecution = (gateId: ToolboxGateId, approved: boolean): ToolboxGateDefinition => {
  const gate = getToolboxGate(gateId)
  if ((gate.mutatesWorkspace || gate.requiresApproval) && !approved) throw new Error('Toolbox gate requires explicit approval.')
  return gate
}
