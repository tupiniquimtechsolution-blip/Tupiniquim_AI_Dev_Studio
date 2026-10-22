import { createHash, randomUUID } from 'node:crypto'
import { PlanApprovalService, type PlanRepository } from '../../../packages/core/src/plan-approval'
import { workspaceCreateInputSchema, workspaceCreateApprovalSchema, type WorkspaceCreateReview } from '../../../packages/contracts/src/workspace-create'
import type { FileDocument, FlightRecorderEvent } from '../../../packages/contracts/src'

type Storage = { get<T>(key: string): Promise<T | undefined>; put<T>(key: string, value: T): Promise<void> }
type Review = WorkspaceCreateReview & { executionId: string; stepId: string; effectId: string; materialized: boolean }
const hash = (content: string): string => createHash('sha256').update(content).digest('hex')

export class WorkspaceCreateService {
  private readonly plans: PlanApprovalService
  private queue: Promise<void> = Promise.resolve()
  constructor(private readonly storage: Storage) {
    const repo: PlanRepository = {
      putPlan: (plan) => storage.put(`create-plan:${plan.id}`, plan),
      getPlan: async (id) => await storage.get(`create-plan:${id}`) ?? null,
      putExecution: (execution) => storage.put(`create-execution:${execution.id}`, execution),
      getExecution: async (id) => await storage.get(`create-execution:${id}`) ?? null,
      putApproval: (approval) => storage.put(`create-approval:${approval.id}`, approval),
      getApproval: async (id) => await storage.get(`create-approval:${id}`) ?? null,
      appendEvent: async (id, event) => { const events = await storage.get<FlightRecorderEvent[]>(`create-events:${id}`) ?? []; await storage.put(`create-events:${id}`, [...events, event]) },
      listEvents: async (id) => await storage.get(`create-events:${id}`) ?? []
    }
    this.plans = new PlanApprovalService(repo)
  }
  async prepare(raw: unknown): Promise<WorkspaceCreateReview> {
    const input = workspaceCreateInputSchema.parse(raw)
    const { plan, execution } = await this.plans.create(`Criar arquivo: ${input.relativePath}`, '/workspace', 'PLAN')
    const step = plan.steps.find((item) => item.requiresApproval)
    if (step === undefined) throw new Error('Plano sem passo de aprovação.')
    const effectId = randomUUID()
    const payloadHash = hash(input.content)
    await this.plans.update(execution.id, { ...plan, steps: plan.steps.map((item) => item.id !== step.id ? item : { ...item, effects: [{ id: effectId, capability: 'workspace.write', operation: 'CREATE', target: input.relativePath, payloadHash, risk: 'HIGH', expectedTargetHash: null }] }) })
    const review: Review = { id: randomUUID(), ...input, payloadHash, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), executionId: execution.id, stepId: step.id, effectId, materialized: false }
    await this.storage.put(`create-review:${review.id}`, review)
    return { id: review.id, relativePath: review.relativePath, content: review.content, payloadHash, expiresAt: review.expiresAt }
  }
  async approve(raw: unknown, create: (relativePath: string, content: string) => Promise<void>): Promise<FileDocument> {
    const preceding = this.queue
    let release = (): void => undefined
    this.queue = new Promise<void>((resolve) => { release = resolve })
    await preceding
    try {
      const { reviewId } = workspaceCreateApprovalSchema.parse(raw)
      const review = await this.storage.get<Review>(`create-review:${reviewId}`)
      if (review === undefined || review.materialized || Date.parse(review.expiresAt) <= Date.now()) throw new Error('Revisão inexistente, expirada ou já utilizada.')
      await this.plans.decide(review.executionId, review.stepId, 'APPROVED', 'ONCE')
      await this.plans.start(review.executionId)
      const effect = await this.plans.claimEffect(review.executionId, review.stepId, review.effectId)
      try {
        if (effect.capability !== 'workspace.write' || effect.operation !== 'CREATE' || effect.source !== undefined || effect.target !== review.relativePath || effect.payloadHash !== hash(review.content)) throw new Error('Manifesto não corresponde ao conteúdo revisado.')
        await create(review.relativePath, review.content)
        await this.plans.completeEffect(review.executionId, review.effectId)
        await this.plans.recordEvidence(review.executionId, 'TOOL', 'Arquivo criado por aprovação manual', review.relativePath, 'SUCCESS')
        await this.storage.put(`create-review:${review.id}`, { ...review, materialized: true })
        return { relativePath: review.relativePath, content: review.content, hash: review.payloadHash, modifiedAt: new Date().toISOString() }
      } catch (cause) { this.plans.abandonEffect(review.executionId, review.effectId); throw cause }
    } finally { release() }
  }
}
