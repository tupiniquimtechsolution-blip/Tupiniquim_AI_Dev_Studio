import { createHash, randomUUID } from 'node:crypto'
import {
  approvalDecisionSchema,
  executionSchema,
  planSchema,
  type ActionManifest,
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

const step = (title: string, description: string, risk: PlanStep['risk'], requiresApproval: boolean): PlanStep => ({ id: randomUUID(), title, description, status: 'PENDING', risk, requiresApproval, effects: [] })

const riskWeight: Record<PlanStep['risk'], number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }

type CanonicalEffect = Pick<ActionManifest, 'id' | 'capability' | 'operation' | 'target' | 'payloadHash' | 'risk'> & {
  expectedTargetHash: ActionManifest['expectedTargetHash']
  source: ActionManifest['source']
}

const canonicalSource = (source: ActionManifest['source']): ActionManifest['source'] => source === undefined ? undefined : ({
  kind: source.kind,
  provider: source.provider,
  threadId: source.threadId,
  turnId: source.turnId,
  toolCallId: source.toolCallId,
  proposalId: source.proposalId,
  tool: source.tool
})

const canonicalEffects = (effects: readonly ActionManifest[]): CanonicalEffect[] => effects
  .map(({ id, capability, operation, target, payloadHash, risk, expectedTargetHash, source }) => ({ id, capability, operation, target, payloadHash, risk, expectedTargetHash, source: canonicalSource(source) }))
  .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))

export const manifestEffectsHash = (effects: readonly ActionManifest[]): string => createHash('sha256').update(JSON.stringify(canonicalEffects(effects))).digest('hex')

const effectRisk = (effects: readonly ActionManifest[]): PlanStep['risk'] => effects.reduce<PlanStep['risk']>((highest, effect) => riskWeight[effect.risk] > riskWeight[highest] ? effect.risk : highest, 'LOW')

const effectTarget = (effects: readonly ActionManifest[]): string => {
  const target = effects.map((effect) => `${effect.capability}:${effect.target}`).join(', ')
  return target.length <= 4096 ? target : `${target.slice(0, 4030)}… (${effects.length} efeitos)`
}

const effectAction = (effects: readonly ActionManifest[]): string => `${effects.length} efeito(s) imutáveis: ${[...new Set(effects.map((effect) => effect.capability))].join(', ')}`.slice(0, 500)

const assertManifest = (step: PlanStep): void => {
  if (step.effects.length === 0) throw new Error(`Passo requer manifesto de efeitos antes da aprovação: ${step.title}`)
}

export class PlanApprovalService {
  private readonly activeEffects = new Set<string>()
  private readonly executionOperations = new Map<string, Promise<void>>()

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
        step('Review e checkpoint', 'Revisar o diff, atualizar a trilha e criar checkpoint recuperável.', 'MEDIUM', false)
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
      completedEffectIds: [],
      createdAt: now,
      updatedAt: now
    })
    await this.repository.putPlan(plan)
    await this.repository.putExecution(execution)
    await this.record(execution.id, 'STATE', 'Plano persistido', `${plan.steps.length} passos; mutações aguardam aprovação.`, 'INFO')
    return { plan, execution }
  }

  public async update(executionId: string, plan: Plan): Promise<Plan> {
    return await this.withExecutionLock(executionId, async () => {
      const execution = await this.repository.getExecution(executionId)
      if (execution === null || execution.planId !== plan.id) throw new Error('Execução não corresponde ao plano a ser atualizado.')
      if (execution.state !== 'WAITING_APPROVAL') throw new Error('Manifesto só pode ser atualizado enquanto a execução aguarda aprovação.')
      const current = await this.repository.getPlan(plan.id)
      if (current === null) throw new Error('Plano não encontrado.')
      const currentPlan = planSchema.parse(current)
      const incoming = planSchema.parse(plan)
      if (incoming.steps.length !== currentPlan.steps.length || incoming.steps.some((candidate, index) => candidate.id !== currentPlan.steps[index]?.id)) {
        throw new Error('A estrutura do plano não pode ser alterada durante uma execução.')
      }
      if (incoming.steps.some((candidate, index) => {
        const currentStep = currentPlan.steps[index]
        return currentStep === undefined || candidate.description !== currentStep.description || candidate.status !== currentStep.status || candidate.risk !== currentStep.risk || candidate.requiresApproval !== currentStep.requiresApproval
      })) {
        throw new Error('Atualização do plano não pode reduzir risco, alterar aprovação ou estado dos passos.')
      }
      const updated = planSchema.parse({ ...incoming, createdAt: currentPlan.createdAt, updatedAt: new Date().toISOString() })
      await this.repository.putPlan(updated)
      if (manifestEffectsHash(currentPlan.steps.flatMap((candidate) => candidate.effects)) !== manifestEffectsHash(updated.steps.flatMap((candidate) => candidate.effects))) {
        await this.record(executionId, 'SYSTEM', 'Manifesto de efeitos atualizado', 'Efeitos mutáveis foram reespecificados; aprovações anteriores serão revalidadas.', 'INFO')
      }
      return updated
    })
  }

  public async read(executionId: string): Promise<PlannedExecution> {
    const storedExecution = await this.repository.getExecution(executionId)
    if (storedExecution === null) throw new Error('Execução não encontrada.')
    const execution = executionSchema.parse(storedExecution)
    const storedPlan = await this.repository.getPlan(execution.planId)
    if (storedPlan === null) throw new Error('Plano associado não encontrado.')
    return { plan: planSchema.parse(storedPlan), execution }
  }

  public async bindThread(executionId: string, threadId: string): Promise<Execution> {
    if (threadId.trim().length === 0 || threadId.length > 200) throw new Error('Thread inválida para vincular à execução.')
    return await this.withExecutionLock(executionId, async () => {
      const stored = await this.repository.getExecution(executionId)
      if (stored === null) throw new Error('Execução não encontrada.')
      const execution = executionSchema.parse(stored)
      if (execution.state !== 'WAITING_APPROVAL') throw new Error('Thread só pode ser vinculada enquanto a execução aguarda aprovação.')
      if (execution.threadId === threadId) return execution
      if (execution.threadId !== null) throw new Error('Execução já está vinculada a outra thread.')
      const updated = executionSchema.parse({ ...execution, threadId, updatedAt: new Date().toISOString() })
      await this.repository.putExecution(updated)
      return updated
    })
  }

  public async decide(executionId: string, stepId: string, decision: 'APPROVED' | 'DENIED', scope: ApprovalScope): Promise<ApprovalDecision> {
    return await this.withExecutionLock(executionId, async () => {
      const { execution, plan } = await this.read(executionId)
      if (execution.state !== 'WAITING_APPROVAL') throw new Error('Decisão só pode ser registrada enquanto a execução aguarda aprovação.')
      const targetStep = plan.steps.find((candidate) => candidate.id === stepId)
      if (targetStep === undefined || !targetStep.requiresApproval) throw new Error('Passo não requer aprovação ou não pertence ao plano.')
      assertManifest(targetStep)
      const approval = approvalDecisionSchema.parse({
        id: randomUUID(),
        executionId,
        stepId,
        action: effectAction(targetStep.effects),
        target: effectTarget(targetStep.effects),
        risk: effectRisk(targetStep.effects),
        effectsHash: manifestEffectsHash(targetStep.effects),
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
    })
  }

  public async start(executionId: string): Promise<Execution> {
    return await this.withExecutionLock(executionId, async () => {
      const { execution, plan } = await this.read(executionId)
      if (execution.state === 'BLOCKED') throw new Error('Execução bloqueada por uma negativa.')
      if (execution.state !== 'WAITING_APPROVAL') throw new Error('Execução só pode iniciar enquanto aguarda aprovação.')
      const approvals = (await Promise.all(execution.approvalIds.map(async (id) => await this.repository.getApproval(id)))).filter((candidate): candidate is ApprovalDecision => candidate !== null)
      for (const targetStep of plan.steps.filter((candidate) => candidate.requiresApproval)) {
        assertManifest(targetStep)
        const expected = manifestEffectsHash(targetStep.effects)
        const relevant = approvals.filter((approval) => approval.stepId === targetStep.id && approval.effectsHash === expected)
        if (relevant.some((approval) => approval.decision === 'DENIED')) throw new Error(`Passo negado: ${targetStep.title}`)
        if (!relevant.some((approval) => approval.decision === 'APPROVED')) throw new Error(`Aprovação pendente: ${targetStep.title}`)
      }
      const updated = executionSchema.parse({ ...execution, state: 'EXECUTION', activeStepId: plan.steps[0]?.id ?? null, updatedAt: new Date().toISOString() })
      await this.repository.putExecution(updated)
      await this.record(executionId, 'STATE', 'Execução autorizada', 'Todos os manifestos de efeitos mutáveis possuem aprovação válida.', 'SUCCESS')
      return updated
    })
  }

  public async recordEvidence(executionId: string, category: Extract<FlightRecorderEvent['category'], 'TOOL' | 'GIT' | 'SYSTEM'>, title: string, detail: string, severity: FlightRecorderEvent['severity']): Promise<void> {
    const { execution } = await this.read(executionId)
    if (execution.state !== 'EXECUTION') throw new Error('Evidência só pode ser registrada durante execução autorizada.')
    await this.record(executionId, category, title, detail, severity)
  }

  public async events(executionId: string): Promise<FlightRecorderEvent[]> { return await this.repository.listEvents(executionId) }

  public async claimEffect(executionId: string, stepId: string, effectId: string): Promise<ActionManifest> {
    return await this.withExecutionLock(executionId, async () => {
      const key = `${executionId}:${effectId}`
      if (this.activeEffects.has(key)) throw new Error('Efeito já está em execução.')
      this.activeEffects.add(key)
      try {
        const { execution, plan } = await this.read(executionId)
        if (execution.state !== 'EXECUTION') throw new Error('Efeito só pode ser materializado durante execução autorizada.')
        if (execution.completedEffectIds.includes(effectId)) throw new Error('Efeito já foi materializado.')
        const step = plan.steps.find((candidate) => candidate.id === stepId)
        if (step === undefined || !step.requiresApproval) throw new Error('Passo não pode materializar efeitos.')
        assertManifest(step)
        const effect = step.effects.find((candidate) => candidate.id === effectId)
        if (effect === undefined) throw new Error('Efeito não pertence ao passo aprovado.')
        const approvals = (await Promise.all(execution.approvalIds.map(async (id) => await this.repository.getApproval(id)))).filter((candidate): candidate is ApprovalDecision => candidate !== null)
        const relevant = approvals.filter((approval) => approval.stepId === step.id && approval.effectsHash === manifestEffectsHash(step.effects))
        if (relevant.some((approval) => approval.decision === 'DENIED')) throw new Error(`Passo negado: ${step.title}`)
        if (!relevant.some((approval) => approval.decision === 'APPROVED')) throw new Error(`Aprovação pendente: ${step.title}`)
        return effect
      } catch (cause) {
        this.activeEffects.delete(key)
        throw cause
      }
    })
  }

  public async completeEffect(executionId: string, effectId: string): Promise<void> {
    await this.withExecutionLock(executionId, async () => {
      const key = `${executionId}:${effectId}`
      if (!this.activeEffects.has(key)) throw new Error('Efeito não foi reservado para materialização.')
      try {
        const storedExecution = await this.repository.getExecution(executionId)
        if (storedExecution === null) throw new Error('Execução não está disponível para concluir o efeito.')
        const execution = executionSchema.parse(storedExecution)
        if (execution.state !== 'EXECUTION') throw new Error('Execução não está disponível para concluir o efeito.')
        if (execution.completedEffectIds.includes(effectId)) throw new Error('Efeito já foi materializado.')
        await this.repository.putExecution(executionSchema.parse({ ...execution, completedEffectIds: [...execution.completedEffectIds, effectId], updatedAt: new Date().toISOString() }))
      } finally {
        this.activeEffects.delete(key)
      }
    })
  }

  public abandonEffect(executionId: string, effectId: string): void {
    this.activeEffects.delete(`${executionId}:${effectId}`)
  }

  private async withExecutionLock<T>(executionId: string, operation: () => Promise<T>): Promise<T> {
    const preceding = this.executionOperations.get(executionId)
    let release = (): void => undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    this.executionOperations.set(executionId, gate)
    if (preceding !== undefined) await preceding
    try {
      return await operation()
    } finally {
      release()
      if (this.executionOperations.get(executionId) === gate) this.executionOperations.delete(executionId)
    }
  }

  private async record(executionId: string, category: FlightRecorderEvent['category'], title: string, detail: string, severity: FlightRecorderEvent['severity']): Promise<void> {
    const execution = await this.repository.getExecution(executionId)
    await this.repository.appendEvent(executionId, { id: randomUUID(), at: new Date().toISOString(), state: execution?.state ?? 'FAILED', category, title, detail, severity })
  }
}
