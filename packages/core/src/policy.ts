import type { PermissionProfile, RiskLevel } from '@tupiniquim/contracts'

export interface ToolIntent {
  capability: string
  target: string
  risk: RiskLevel
  destructive: boolean
  requiresNetwork: boolean
}
export interface PolicyDecision {
  allowed: boolean
  requiresApproval: boolean
  reason: string
}

const absoluteBlocks = [
  /git\s+reset\s+--hard/i,
  /git\s+push\b.*(--force|-f)\b/i,
  /remove-item\b.*-recurse\b.*(?:[a-z]:\\|~|\$home)\s*$/i,
  /format(?:-volume)?\b/i,
  /diskpart\b/i
]

export const containsAbsolutelyBlockedCommand = (command: string): boolean => absoluteBlocks.some((pattern) => pattern.test(command))

export class PolicyEngine {
  public constructor(private readonly profile: PermissionProfile = 'ASSISTED') {}

  public evaluate(intent: ToolIntent): PolicyDecision {
    if (intent.capability === 'terminal.command' && containsAbsolutelyBlockedCommand(intent.target)) {
      return { allowed: false, requiresApproval: false, reason: 'Comando bloqueado pela política absoluta.' }
    }
    if (this.profile === 'SAFE') {
      const readOnly = !intent.destructive && !intent.requiresNetwork && intent.risk === 'LOW'
      return readOnly
        ? { allowed: true, requiresApproval: false, reason: 'Leitura local de baixo risco.' }
        : { allowed: false, requiresApproval: false, reason: 'Perfil SAFE permite apenas leitura local de baixo risco.' }
    }
    if (this.profile === 'ASSISTED') {
      const approval = intent.destructive || intent.requiresNetwork || intent.risk === 'HIGH' || intent.risk === 'CRITICAL'
      return { allowed: true, requiresApproval: approval, reason: approval ? 'Ação requer aprovação no perfil ASSISTED.' : 'Ação permitida no escopo do workspace.' }
    }
    if (this.profile === 'AUTONOMOUS') {
      const approval = intent.destructive || intent.risk === 'CRITICAL'
      return { allowed: true, requiresApproval: approval, reason: approval ? 'Ação crítica requer aprovação.' : 'Ação permitida pelo perfil AUTONOMOUS.' }
    }
    return { allowed: true, requiresApproval: intent.risk === 'CRITICAL', reason: 'FULL_ACCESS mantém bloqueios absolutos e auditoria.' }
  }
}
