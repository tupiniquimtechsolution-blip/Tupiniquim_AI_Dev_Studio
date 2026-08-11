import { describe, expect, it } from 'vitest'
import { PolicyEngine, containsAbsolutelyBlockedCommand } from './policy'

describe('PolicyEngine', () => {
  it('bloqueia operações Git destrutivas em qualquer perfil', () => {
    expect(containsAbsolutelyBlockedCommand('git reset --hard HEAD~1')).toBe(true)
    expect(new PolicyEngine('FULL_ACCESS').evaluate({ capability: 'terminal.command', target: 'git push --force origin main', risk: 'CRITICAL', destructive: true, requiresNetwork: true }).allowed).toBe(false)
  })

  it('exige aprovação para escrita de alto risco em ASSISTED', () => {
    const decision = new PolicyEngine('ASSISTED').evaluate({ capability: 'workspace.write', target: 'src/app.ts', risk: 'HIGH', destructive: false, requiresNetwork: false })
    expect(decision).toMatchObject({ allowed: true, requiresApproval: true })
  })

  it('mantém leituras locais de baixo risco disponíveis', () => {
    const decision = new PolicyEngine('SAFE').evaluate({ capability: 'workspace.read', target: 'README.md', risk: 'LOW', destructive: false, requiresNetwork: false })
    expect(decision).toMatchObject({ allowed: true, requiresApproval: false })
  })
})
