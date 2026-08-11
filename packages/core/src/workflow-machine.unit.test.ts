import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { workflowMachine } from './workflow-machine'

describe('workflowMachine', () => {
  it('percorre Plan/Approval/Execute até COMPLETED', () => {
    const actor = createActor(workflowMachine).start()
    actor.send({ type: 'SUBMIT', objective: 'Criar recurso', mode: 'PLAN' })
    actor.send({ type: 'UNDERSTOOD', needsResearch: false })
    actor.send({ type: 'PLAN_READY' })
    expect(actor.getSnapshot().value).toBe('WAITING_APPROVAL')
    actor.send({ type: 'APPROVE' })
    actor.send({ type: 'EXECUTED' })
    actor.send({ type: 'VALIDATED' })
    actor.send({ type: 'REVIEWED' })
    expect(actor.getSnapshot().value).toBe('COMPLETED')
  })

  it('preserva um estado retomável ao falhar', () => {
    const actor = createActor(workflowMachine).start()
    actor.send({ type: 'SUBMIT', objective: 'Teste', mode: 'DEBUG' })
    actor.send({ type: 'FAIL', message: 'Falha controlada' })
    expect(actor.getSnapshot().context.error).toBe('Falha controlada')
    actor.send({ type: 'RETRY' })
    expect(actor.getSnapshot().value).toBe('UNDERSTANDING')
  })
})
