import type { ToolboxGateId } from './toolbox-gates'

export interface ToolboxPnpmInvocation {
  scriptOrCommand: string
  args: string[]
}

const invocationCatalog: Partial<Record<ToolboxGateId, readonly ToolboxPnpmInvocation[]>> = {
  'quality-gates': [
    { scriptOrCommand: 'lint', args: [] },
    { scriptOrCommand: 'typecheck', args: [] },
    { scriptOrCommand: 'test:unit', args: [] },
    { scriptOrCommand: 'test:integration', args: [] },
    { scriptOrCommand: 'test:security', args: [] },
    { scriptOrCommand: 'build', args: [] }
  ],
  'dependency-audit': [{ scriptOrCommand: 'audit', args: ['--prod'] }],
  'security-review': [{ scriptOrCommand: 'test:security', args: [] }],
  'supply-chain': [{ scriptOrCommand: 'install', args: ['--frozen-lockfile'] }]
}

export const toolboxGateInvocations = (gateId: ToolboxGateId): readonly ToolboxPnpmInvocation[] | null => invocationCatalog[gateId] ?? null

export interface ToolboxInvocationExecutor {
  execute(invocation: ToolboxPnpmInvocation): Promise<{ exitCode: number; stdout: string; stderr: string }>
}

export interface ToolboxExecutionResult {
  gateId: ToolboxGateId
  state: 'PASS' | 'FAIL' | 'NOT_AVAILABLE'
  steps: Array<{ invocation: ToolboxPnpmInvocation; exitCode: number }>
  evidence: string
}

const redact = (value: string): string => value
  .replace(/(?:sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,})/g, '[REDACTED_SECRET]')
  .slice(0, 20_000)

export const runToolboxGate = async (gateId: ToolboxGateId, executor: ToolboxInvocationExecutor): Promise<ToolboxExecutionResult> => {
  const invocations = toolboxGateInvocations(gateId)
  if (invocations === null) return { gateId, state: 'NOT_AVAILABLE', steps: [], evidence: 'Nenhum executor automático canônico está registrado para este gate.' }

  const steps: ToolboxExecutionResult['steps'] = []
  const evidence: string[] = []
  for (const invocation of invocations) {
    const result = await executor.execute(invocation)
    steps.push({ invocation, exitCode: result.exitCode })
    evidence.push(`$ pnpm ${invocation.scriptOrCommand} ${invocation.args.join(' ')}`.trim(), redact(result.stdout), redact(result.stderr))
    if (result.exitCode !== 0) return { gateId, state: 'FAIL', steps, evidence: evidence.join('\n') }
  }
  return { gateId, state: 'PASS', steps, evidence: evidence.join('\n') }
}
