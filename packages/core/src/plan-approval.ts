import { createHash, randomUUID } from 'node:crypto'
import {
  approvalDecisionSchema,
  executionSchema,
  planSchema,
  type ApprovalDecision,
  type ApprovalScope,
  type Execution,
  type FlightRecorderEvent,
  type Mode,
  type Plan,
  type PlanStep
} from '@tupiniquim/contracts'

export interface PlanRepository {
  putPlan(plan: Plan): Promise<void>
  getPlan(id: string): Promise<Plan | null>
  putExecution(execution: Execution): Promise<void>
  getExecution(id: string): Promise<Execution | null>
  putApproval(decision: ApprovalDecision): Promise<void>
  getApproval(id: string): Promise<ApprovalDecision | null>
  appendEvent(executionId: string, event: FlightRecorderEvent): Promise<void>
  listEvents(executionId: string): Promise<FlightRecorderEvent[]>
}

export interface PlannedExecution { plan: Plan; execution: Execution }

const step = (title: string, description: string, risk: PlanStep['risk'], requiresApproval: boolean): PlanStep => ({ id: randomUUID(), title, description, status: 'PENDING', risk, requiresApproval })

const effectsHash = (action: string, target: string, risk: string): string => createHash('sha256').update(JSON.stringify({ action, target, risk })).digest('hex')

export class PlanApprovalService {
  public constructor(private readonly repository: PlanRepository) {}

  public async create(objective: string, workspaceRoot: string, mode: Mode): Promise<PlannedExecution> {
    const now = new Date().toISOString()
    const plan = planSchema.parse({
      id: randomUUID(),
      title: objective.length > 72 ? `${objective.slice(0, 69)}…` : objective,
      objective,
      createdAt: now,
      updatedAt: now,
      steps: [
        step('Entender e mapear', 'Confirmar requisitos, restrições e arquivos afetados.', 'LOW', false),
        step('Implementar mudanças', 'Aplicar somente as mudanças aprovadas dentro do workspace.', 'HIGH', true),
        step('Validar', 'Executar testes proporcionais ao risco e corrigir regressões.', 'MEDIUM', false),
        step('Review e checkpoint', 'Revisar o diff, atualizar a trilha e criar checkpoint recuperável.', 'MEDIUM', true)
      ]
    })
    const execution = executionSchema.parse({
      id: randomUUID(),
      planId: plan.id,
      mode,
      state: 'WAITING_APPROVAL',
      permissionProfile: 'ASSISTED',
      workspaceRoot,
      activeStepId: plan.steps.find((candidate) => candidate.requiresApproval)?.id ?? null,
      threadId: null,
      approvalIds: [],
      createdAt: now,
      updatedAt: now
    })
    await this.repository.putPlan(plan)
    await this.repository.putExecution(execution)
    await this.record(execution.id, 'STATE', 'Plano persistido', `${plan.steps.length} passos; mutações aguardam aprovação.`, 'INFO')
    return { plan, execution }
  }

  public async update(plan: Plan): Promise<Plan> {
    const current = await this.repository.getPlan(plan.id)
    if (current === null) throw new Error('Plano não encontrado.')
    const updated = planSchema.parse({ ...plan, createdAt: current.createdAt, updatedAt: new Date().toISOString() })
    await this.repository.putPlan(updated)
    return updated
  }

  public async read(executionId: string): Promise<PlannedExecution> {
    const execution = await this.repository.getExecution(executionId)
    if (execution === null) throw new Error('Execução não encontrada.')
    const plan = await this.repository.getPlan(execution.planId)
    if (plan === null) throw new Error('Plano associado não encontrado.')
    return { plan, execution }
  }

  public async decide(executionId: string, stepId: string, decision: 'APPROVED' | 'DENIED', scope: ApprovalScope): Promise<ApprovalDecision> {
    const { execution, plan } = await this.read(executionId)
    const targetStep = plan.steps.find((candidate) => candidate.id === stepId)
    if (targetStep === undefined || !targetStep.requiresApproval) throw new Error('Passo não requer aprovação ou não pertence ao plano.')
    const approval = approvalDecisionSchema.parse({
      id: randomUUID(),
      executionId,
      stepId,
      action: targetStep.title,
      target: execution.workspaceRoot,
      risk: targetStep.risk,
      effectsHash: effectsHash(targetStep.title, execution.workspaceRoot, targetStep.risk),
      scope,
      decision,
      decidedAt: new Date().toISOString()
    })
    await this.repository.putApproval(approval)
    const updated = executionSchema.parse({
      ...execution,
      state: decision === 'DENIED' ? 'BLOCKED' : execution.state,
      approvalIds: [...execution.approvalIds, approval.id],
      updatedAt: new Date().toISOString()
    })
    await this.repository.putExecution(updated)
    await this.record(executionId, 'APPROVAL', decision === 'APPROVED' ? 'Ação aprovada' : 'Ação negada', `${targetStep.title} · ${scope}`, decision === 'APPROVED' ? 'SUCCESS' : 'WARNING')
    return approval
  }

  public async start(executionId: string): Promise<Execution> {
    const { execution, plan } = await this.read(executionId)
    if (execution.state === 'BLOCKED') throw new Error('Execução bloqueada por uma negativa.')
    const approvals = (await Promise.all(execution.approvalIds.map(async (id) => await this.repository.getApproval(id)))).filter((candidate): candidate is ApprovalDecision => candidate !== null)
    for (const targetStep of plan.steps.filter((candidate) => candidate.requiresApproval)) {
      const expected = effectsHash(targetStep.title, execution.workspaceRoot, targetStep.risk)
      const relevant = approvals.filter((approval) => approval.stepId === targetStep.id && approval.effectsHash === expected)
      if (relevant.some((approval) => approval.decision === 'DENIED')) throw new Error(`Passo negado: ${targetStep.title}`)
      if (!relevant.some((approval) => approval.decision === 'APPROVED')) throw new Error(`Aprovação pendente: ${targetStep.title}`)
    }
    const updated = executionSchema.parse({ ...execution, state: 'EXECUTION', activeStepId: plan.steps[0]?.id ?? null, updatedAt: new Date().toISOString() })
    await this.repository.putExecution(updated)
    await this.record(executionId, 'STATE', 'Execução autorizada', 'Todos os efeitos mutáveis possuem aprovação válida.', 'SUCCESS')
    return updated
  }

  public async events(executionId: string): Promise<FlightRecorderEvent[]> { return await this.repository.listEvents(executionId) }

  private async record(executionId: string, category: FlightRecorderEvent['category'], title: string, detail: string, severity: FlightRecorderEvent['severity']): Promise<void> {
    const execution = await this.repository.getExecution(executionId)
    await this.repository.appendEvent(executionId, { id: randomUUID(), at: new Date().toISOString(), state: execution?.state ?? 'FAILED', category, title, detail, severity })
  }
}
