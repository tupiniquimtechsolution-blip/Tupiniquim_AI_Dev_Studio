import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalDatabase } from '@tupiniquim/adapters'
import { PlanApprovalService } from '@tupiniquim/core'

let fixture = ''
let database: LocalDatabase

beforeEach(async () => {
  const temp = process.env.TEMP
  if (temp === undefined || path.parse(temp).root.toUpperCase() !== 'F:\\') throw new Error('TEMP de testes precisa estar em F:.')
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
    for (const targetStep of planned.plan.steps.filter((candidate) => candidate.requiresApproval)) {
      await service.decide(planned.execution.id, targetStep.id, 'APPROVED', 'TASK')
    }
    const execution = await service.start(planned.execution.id)
    expect(execution.state).toBe('EXECUTION')
    expect((await service.read(execution.id)).plan.objective).toContain('capacidade')
    expect((await service.events(execution.id)).map((event) => event.category)).toContain('APPROVAL')
  })

  it('faz a negativa prevalecer mesmo após uma aprovação anterior', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Validar precedência da negativa', fixture, 'PLAN')
    const targetStep = planned.plan.steps.find((candidate) => candidate.requiresApproval)
    if (targetStep === undefined) throw new Error('Fixture sem passo aprovável.')
    await service.decide(planned.execution.id, targetStep.id, 'APPROVED', 'TASK')
    await service.decide(planned.execution.id, targetStep.id, 'DENIED', 'TASK')
    await expect(service.start(planned.execution.id)).rejects.toThrow('bloqueada')
  })
})
