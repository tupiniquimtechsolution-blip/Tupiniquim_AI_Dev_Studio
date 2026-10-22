type CommandResult = { code: number; stdout: string; stderr: string }
type Execute = (bin: string, args: string[]) => Promise<CommandResult>
export type GatewayGateResult = { state: 'PASS' | 'FAIL' | 'NOT_AVAILABLE'; evidence: string }

const commands: Record<string, Array<[string, string[]]>> = {
  'quality-gates': ['lint', 'typecheck', 'test:unit', 'test:integration', 'test:security', 'build'].map((script) => ['pnpm', [script]]),
  'dependency-audit': [['pnpm', ['audit', '--audit-level', 'high']]],
  'security-review': [['pnpm', ['test:security']]]
}
const unavailable = new Set(['privacy-lgpd', 'accessibility-wcag', 'architecture-review', 'release-checklist', 'supply-chain'])

export const executeGatewayGate = async (gateId: string, execute: Execute): Promise<GatewayGateResult> => {
  if (unavailable.has(gateId)) return { state: 'NOT_AVAILABLE', evidence: gateId === 'supply-chain'
    ? 'Instalação altera o workspace e requer fluxo de aprovação específico; nenhum comando foi executado.'
    : 'Nenhum executor de aceite completo registrado. Busca textual ou build isolado não certificam este gate.' }
  if (gateId === 'secret-scan') {
    // Quiet mode: matching lines and paths never enter evidence or the response.
    const result = await execute('git', ['grep', '-qE', '(sk-(proj-)?[A-Za-z0-9_-]{20,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY)', '--', '.', ':!pnpm-lock.yaml', ':!**/.env*', ':!.env*'])
    if (result.code === 1) return { state: 'PASS', evidence: 'Nenhum padrão de secret encontrado nos arquivos rastreados elegíveis. Não certifica arquivos excluídos nem histórico Git.' }
    return { state: 'FAIL', evidence: result.code === 0 ? 'Padrão sensível encontrado. Conteúdo omitido; requer revisão privada.' : `Scanner indisponível ou falhou (exit ${result.code}); conteúdo omitido.` }
  }
  const steps = commands[gateId]
  if (steps === undefined) throw new Error('Gate desconhecido.')
  const evidence: string[] = []
  for (const [bin, args] of steps) {
    const result = await execute(bin, args)
    // A command can emit arbitrary workspace data. Record execution/exit only.
    evidence.push(`${bin} ${args.join(' ')}: exit ${result.code}`)
    if (result.code !== 0) return { state: 'FAIL', evidence: evidence.join('\n') }
  }
  return { state: 'PASS', evidence: evidence.join('\n') }
}
