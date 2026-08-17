import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalDatabase } from '@tupiniquim/adapters'
import { PlanApprovalService } from '@tupiniquim/core'

let fixture = ''
let database: LocalDatabase

const materializeEffects = (plan: Awaited<ReturnType<PlanApprovalService['create']>>['plan'], targetPrefix = 'src/alteracao'): typeof plan => ({
  ...plan,
  steps: plan.steps.map((step, index) => step.requiresApproval ? {
    ...step,
    effects: [{
      id: crypto.randomUUID(),
      capability: 'workspace.write' as const,
      operation: 'REPLACE' as const,
      target: `${targetPrefix}-${String(index)}.ts`,
      payloadHash: String(index + 1).repeat(64),
      risk: 'HIGH' as const
    }]
  } : step)
})

beforeEach(async () => {
  const temp = process.env.TEMP
  if (temp === undefined || path.parse(temp).root.toUpperCase() !== 'D:\\') throw new Error('TEMP de testes precisa estar em D:.')
  fixture = await mkdtemp(path.join(temp, 'tupiniquim-sqlite-'))
  database = new LocalDatabase(fixture)
})

afterEach(async () => {
  await database.close()
  await rm(fixture, { recursive: true, force: true })
})

describe('persistência Plan/Approval/Execute', () => {
  it('migra SQLite em worker, persiste o plano e autoriza somente após todas as aprovações', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Implementar uma capacidade verificável', fixture, 'PLAN')
    const plan = await service.update(planned.execution.id, materializeEffects(planned.plan))
    for (const targetStep of plan.steps.filter((candidate) => candidate.requiresApproval)) {
      await service.decide(planned.execution.id, targetStep.id, 'APPROVED', 'TASK')
    }
    const execution = await service.start(planned.execution.id)
    expect(execution.state).toBe('EXECUTION')
    await service.recordEvidence(execution.id, 'TOOL', 'Baseline lido', 'Leitura local sem mutação.', 'SUCCESS')
    expect((await service.read(execution.id)).plan.objective).toContain('capacidade')
    expect((await service.events(execution.id)).map((event) => event.category)).toEqual(expect.arrayContaining(['APPROVAL', 'TOOL']))
  })

  it('faz a negativa prevalecer mesmo após uma aprovação anterior', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Validar precedência da negativa', fixture, 'PLAN')
    const plan = await service.update(planned.execution.id, materializeEffects(planned.plan))
    const targetStep = plan.steps.find((candidate) => candidate.requiresApproval)
    if (targetStep === undefined) throw new Error('Fixture sem passo aprovável.')
    await service.decide(planned.execution.id, targetStep.id, 'APPROVED', 'TASK')
    await service.decide(planned.execution.id, targetStep.id, 'DENIED', 'TASK')
    await expect(service.start(planned.execution.id)).rejects.toThrow('bloqueada')
  })

  it('rejeita evidência de ferramenta antes da execução autorizada', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Não registrar tool antes de aprovar', fixture, 'PLAN')
    await expect(service.recordEvidence(planned.execution.id, 'TOOL', 'Leitura', 'Não deve executar.', 'SUCCESS')).rejects.toThrow('execução autorizada')
  })

  it('exige manifesto e invalida aprovação quando alvo ou efeito muda', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Vincular efeito exato à aprovação', fixture, 'PLAN')
    const firstApprovalStep = planned.plan.steps.find((candidate) => candidate.requiresApproval)
    if (firstApprovalStep === undefined) throw new Error('Fixture sem passo aprovável.')
    const loweredApproval = {
      ...planned.plan,
      steps: planned.plan.steps.map((step) => step.id === firstApprovalStep.id ? { ...step, requiresApproval: false } : step)
    }
    await expect(service.update(planned.execution.id, loweredApproval)).rejects.toThrow('não pode reduzir risco, alterar aprovação ou estado')
    await expect(service.decide(planned.execution.id, firstApprovalStep.id, 'APPROVED', 'TASK')).rejects.toThrow('manifesto de efeitos')
    const approvedPlan = await service.update(planned.execution.id, materializeEffects(planned.plan, 'src/original'))
    for (const targetStep of approvedPlan.steps.filter((candidate) => candidate.requiresApproval)) {
      await service.decide(planned.execution.id, targetStep.id, 'APPROVED', 'TASK')
    }
    await service.update(planned.execution.id, materializeEffects(approvedPlan, 'src/destino-alterado'))
    await expect(service.start(planned.execution.id)).rejects.toThrow('Aprovação pendente')
  })

  it('reserva um único efeito aprovado e impede materialização duplicada', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Materializar somente um efeito aprovado', fixture, 'PLAN')
    const plan = await service.update(planned.execution.id, materializeEffects(planned.plan))
    for (const step of plan.steps.filter((candidate) => candidate.requiresApproval)) {
      await service.decide(planned.execution.id, step.id, 'APPROVED', 'TASK')
    }
    await service.start(planned.execution.id)
    const step = plan.steps.find((candidate) => candidate.requiresApproval)
    const effect = step?.effects[0]
    if (step === undefined || effect === undefined) throw new Error('Fixture sem efeito aprovável.')
    await expect(service.claimEffect(planned.execution.id, step.id, effect.id)).resolves.toMatchObject({ id: effect.id, target: effect.target })
    await expect(service.claimEffect(planned.execution.id, step.id, effect.id)).rejects.toThrow('já está em execução')
    await service.completeEffect(planned.execution.id, effect.id)
    expect((await service.read(planned.execution.id)).execution.completedEffectIds).toContain(effect.id)
    await expect(service.claimEffect(planned.execution.id, step.id, effect.id)).rejects.toThrow('já foi materializado')
  })

  it('persiste threads, turns e eventos de IA sem armazenar o conteúdo da entrada', async () => {
    const now = new Date().toISOString()
    const thread = { id: 'thread-persistida', provider: 'codex-app-server' as const, workspaceRoot: fixture, model: 'gpt-test', createdAt: now, updatedAt: now }
    const turn = { id: 'turn-persistido', threadId: thread.id, mode: 'CHAT' as const, inputHash: 'a'.repeat(64), createdAt: now }
    const event = { id: crypto.randomUUID(), at: now, kind: 'TURN_STARTED' as const, threadId: thread.id, turnId: turn.id }
    await database.putAIThread(thread)
    await database.putAITurn(turn)
    await database.appendAIEvent(event)
    expect(await database.getAIThread(thread.id)).toMatchObject({ id: thread.id, model: 'gpt-test' })
    expect(await database.listAITurns(thread.id)).toEqual([turn])
    expect(await database.listAIEvents(thread.id)).toEqual([event])
  })
})
