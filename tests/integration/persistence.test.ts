import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalDatabase } from '@tupiniquim/adapters'
import { workspaceWriteProposalSchema, type AIThread, type AITurn, type Execution } from '@tupiniquim/contracts'
import { PlanApprovalService, WorkspaceWriteProposalService } from '@tupiniquim/core'

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
    expect(planned.plan.steps.find((candidate) => candidate.title === 'Review e checkpoint')).toMatchObject({ risk: 'MEDIUM', requiresApproval: false })
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

  it('normaliza execuções legadas sem completedEffectIds ao retomar o plano', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Retomar execução legada', fixture, 'PLAN')
    const legacy = { ...planned.execution } as Record<string, unknown>
    delete legacy.completedEffectIds
    await database.putExecution(legacy as unknown as Execution)
    expect((await service.read(planned.execution.id)).execution.completedEffectIds).toEqual([])
  })

  it('persiste somente o primeiro vínculo de thread e recusa vínculo após EXECUTION', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Vincular execução à thread de origem', fixture, 'PLAN')
    const [first, competing] = await Promise.allSettled([
      service.bindThread(planned.execution.id, 'thread-principal'),
      service.bindThread(planned.execution.id, 'thread-concorrente')
    ])
    expect(first.status).toBe('fulfilled')
    if (first.status !== 'fulfilled') throw new Error('O primeiro vínculo deveria ter sido persistido.')
    expect(first.value).toMatchObject({ threadId: 'thread-principal' })
    expect(competing.status).toBe('rejected')
    if (competing.status !== 'rejected') throw new Error('O vínculo concorrente deveria ter sido recusado.')
    expect(String(competing.reason)).toContain('outra thread')
    await expect(service.bindThread(planned.execution.id, 'thread-principal')).resolves.toMatchObject({ threadId: 'thread-principal' })
    expect((await service.read(planned.execution.id)).execution.threadId).toBe('thread-principal')

    const plan = await service.update(planned.execution.id, materializeEffects(planned.plan))
    for (const targetStep of plan.steps.filter((candidate) => candidate.requiresApproval)) {
      await service.decide(planned.execution.id, targetStep.id, 'APPROVED', 'TASK')
    }
    await service.start(planned.execution.id)
    await expect(service.bindThread(planned.execution.id, 'thread-principal')).rejects.toThrow('aguarda aprovação')
  })

  it('restringe update, bind, decide e start exatamente ao estado WAITING_APPROVAL', async () => {
    const service = new PlanApprovalService(database)
    const executable = await service.create('Validar transições após iniciar', fixture, 'PLAN')
    const executablePlan = await service.update(executable.execution.id, materializeEffects(executable.plan, 'src/execution'))
    const executableStep = executablePlan.steps.find((candidate) => candidate.requiresApproval)
    if (executableStep === undefined) throw new Error('Fixture sem passo aprovável.')
    await service.decide(executable.execution.id, executableStep.id, 'APPROVED', 'TASK')
    await service.start(executable.execution.id)
    await expect(service.update(executable.execution.id, executablePlan)).rejects.toThrow('aguarda aprovação')
    await expect(service.bindThread(executable.execution.id, 'thread-tardia')).rejects.toThrow('aguarda aprovação')
    await expect(service.decide(executable.execution.id, executableStep.id, 'APPROVED', 'TASK')).rejects.toThrow('aguarda aprovação')
    await expect(service.start(executable.execution.id)).rejects.toThrow('só pode iniciar')

    const blocked = await service.create('Validar transições após negativa', fixture, 'PLAN')
    const blockedPlan = await service.update(blocked.execution.id, materializeEffects(blocked.plan, 'src/blocked'))
    const blockedStep = blockedPlan.steps.find((candidate) => candidate.requiresApproval)
    if (blockedStep === undefined) throw new Error('Fixture sem passo aprovável.')
    await service.decide(blocked.execution.id, blockedStep.id, 'DENIED', 'TASK')
    await expect(service.update(blocked.execution.id, blockedPlan)).rejects.toThrow('aguarda aprovação')
    await expect(service.bindThread(blocked.execution.id, 'thread-bloqueada')).rejects.toThrow('aguarda aprovação')
    await expect(service.decide(blocked.execution.id, blockedStep.id, 'APPROVED', 'TASK')).rejects.toThrow('aguarda aprovação')
    await expect(service.start(blocked.execution.id)).rejects.toThrow('bloqueada')
  })

  it('serializa bind×start e start×start sem perder vínculo ou aprovações', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Serializar início da execução', fixture, 'PLAN')
    const plan = await service.update(planned.execution.id, materializeEffects(planned.plan, 'src/race-start'))
    const step = plan.steps.find((candidate) => candidate.requiresApproval)
    if (step === undefined) throw new Error('Fixture sem passo aprovável.')
    const approval = await service.decide(planned.execution.id, step.id, 'APPROVED', 'TASK')
    const [binding, firstStart, competingStart] = await Promise.allSettled([
      service.bindThread(planned.execution.id, 'thread-race'),
      service.start(planned.execution.id),
      service.start(planned.execution.id)
    ])
    expect(binding.status).toBe('fulfilled')
    expect(firstStart.status).toBe('fulfilled')
    expect(competingStart.status).toBe('rejected')
    const persisted = (await service.read(planned.execution.id)).execution
    expect(persisted).toMatchObject({ state: 'EXECUTION', threadId: 'thread-race' })
    expect(persisted.approvalIds).toContain(approval.id)
  })

  it('preserva todos os campos ao concluir efeitos diferentes concorrentemente', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Concluir efeitos sem lost update', fixture, 'PLAN')
    await service.bindThread(planned.execution.id, 'thread-complete')
    const singleEffectPlan = materializeEffects(planned.plan, 'src/complete')
    const targetStep = singleEffectPlan.steps.find((candidate) => candidate.requiresApproval)
    const firstEffect = targetStep?.effects[0]
    if (targetStep === undefined || firstEffect === undefined) throw new Error('Fixture sem efeito aprovável.')
    const secondEffect = { ...firstEffect, id: crypto.randomUUID(), target: 'src/complete-segundo.ts', payloadHash: '8'.repeat(64) }
    const plan = await service.update(planned.execution.id, {
      ...singleEffectPlan,
      steps: singleEffectPlan.steps.map((candidate) => candidate.id === targetStep.id ? { ...candidate, effects: [firstEffect, secondEffect] } : candidate)
    })
    const approval = await service.decide(planned.execution.id, targetStep.id, 'APPROVED', 'TASK')
    await service.start(planned.execution.id)
    await Promise.all([
      service.claimEffect(planned.execution.id, targetStep.id, firstEffect.id),
      service.claimEffect(planned.execution.id, targetStep.id, secondEffect.id)
    ])
    const before = (await service.read(planned.execution.id)).execution
    await Promise.all([
      service.completeEffect(planned.execution.id, firstEffect.id),
      service.completeEffect(planned.execution.id, secondEffect.id)
    ])
    const after = (await service.read(planned.execution.id)).execution
    expect(after).toMatchObject({
      planId: plan.id,
      state: 'EXECUTION',
      threadId: 'thread-complete',
      activeStepId: before.activeStepId,
      approvalIds: [approval.id]
    })
    expect([...after.completedEffectIds].sort()).toEqual([firstEffect.id, secondEffect.id].sort())
  })

  it('mantém proposta somente em memória e revalida a proveniência completa', async () => {
    const now = new Date().toISOString()
    const thread = { id: 'thread-proposta', provider: 'ollama' as const, workspaceRoot: fixture, model: 'modelo-teste', createdAt: now, updatedAt: now }
    const turn = { id: 'turn-proposta', threadId: thread.id, mode: 'PLAN' as const, inputHash: 'b'.repeat(64), createdAt: now }
    await database.putAIThread(thread)
    await database.putAITurn(turn)
    const planning = new PlanApprovalService(database)
    const proposals = new WorkspaceWriteProposalService(planning, database, () => fixture, { inspectBaseline: () => Promise.resolve({ exists: false, hash: null }) })
    const planned = await planning.create('Propor escrita com proveniência', fixture, 'PLAN')
    const step = planned.plan.steps.find((candidate) => candidate.requiresApproval)
    if (step === undefined) throw new Error('Fixture sem passo aprovável.')
    await expect(proposals.propose({ executionId: planned.execution.id, stepId: step.id, provider: thread.provider, threadId: thread.id, turnId: turn.id, toolCallId: 'nao-e-uuid', tool: 'workspace.write', relativePath: 'src/chamada-invalida.ts', content: 'não deve virar proposta', operation: 'CREATE', targetBaselineHash: null })).rejects.toThrow('Proveniência')
    await expect(proposals.propose({ executionId: planned.execution.id, stepId: crypto.randomUUID(), provider: thread.provider, threadId: thread.id, turnId: turn.id, toolCallId: crypto.randomUUID(), tool: 'workspace.write', relativePath: 'src/passo-invalido.ts', content: 'não deve vincular a execução', operation: 'CREATE', targetBaselineHash: null })).rejects.toThrow('Passo não aceita')
    expect((await planning.read(planned.execution.id)).execution.threadId).toBeNull()
    const firstToolCallId = crypto.randomUUID()
    const first = await proposals.propose({ executionId: planned.execution.id, stepId: step.id, provider: thread.provider, threadId: thread.id, turnId: turn.id, toolCallId: firstToolCallId, tool: 'workspace.write', relativePath: 'src/proposta.ts', content: 'conteúdo privado da proposta', operation: 'CREATE', targetBaselineHash: null })
    expect(JSON.stringify(first)).not.toContain('conteúdo privado')
    expect(workspaceWriteProposalSchema.safeParse(first).success).toBe(true)
    expect(first).toMatchObject({ provider: thread.provider, threadId: thread.id, turnId: turn.id, toolCallId: firstToolCallId, tool: 'workspace.write', effect: { target: 'src/proposta.ts', capability: 'workspace.write', expectedTargetHash: null, source: { kind: 'AGENT_PROPOSAL', provider: thread.provider, threadId: thread.id, turnId: turn.id, toolCallId: firstToolCallId, proposalId: first.id, tool: 'workspace.write' } } })
    expect(workspaceWriteProposalSchema.safeParse({ ...first, effect: { ...first.effect, source: undefined } }).success).toBe(false)
    expect(workspaceWriteProposalSchema.safeParse({ ...first, provider: 'codex-app-server' }).success).toBe(false)
    expect((await planning.read(planned.execution.id)).execution.threadId).toBe(thread.id)
    await expect(planning.bindThread(planned.execution.id, 'thread-diferente')).rejects.toThrow('outra thread')
    await expect(proposals.propose({ executionId: planned.execution.id, stepId: step.id, provider: 'codex-app-server', threadId: thread.id, turnId: turn.id, toolCallId: crypto.randomUUID(), tool: 'workspace.write', relativePath: 'src/provider-invalido.ts', content: 'não deve virar proposta', operation: 'CREATE', targetBaselineHash: null })).rejects.toThrow('Provider ou thread')
    expect((await planning.read(planned.execution.id)).plan.steps.find((candidate) => candidate.id === step.id)?.effects).toHaveLength(1)
    const secondBaselineHash = 'd'.repeat(64)
    const second = await proposals.propose({ executionId: planned.execution.id, stepId: step.id, provider: thread.provider, threadId: thread.id, turnId: turn.id, toolCallId: crypto.randomUUID(), tool: 'workspace.write', relativePath: 'src/substituida.ts', content: 'novo conteúdo privado', operation: 'REPLACE', targetBaselineHash: secondBaselineHash })
    await expect(proposals.consume(first.id)).rejects.toThrow('não está disponível')
    await expect(proposals.consume(second.id)).resolves.toMatchObject({ proposal: { id: second.id, provider: thread.provider, tool: 'workspace.write', effect: { target: 'src/substituida.ts', expectedTargetHash: secondBaselineHash } }, content: 'novo conteúdo privado' })
    const altered = await planning.read(planned.execution.id)
    await planning.update(planned.execution.id, {
      ...altered.plan,
      steps: altered.plan.steps.map((candidate) => candidate.id === step.id ? {
        ...candidate,
        effects: candidate.effects.map((effect) => effect.id === second.effect.id ? { ...effect, target: 'src/alvo-adulterado.ts' } : effect)
      } : candidate)
    })
    await expect(proposals.consume(second.id)).rejects.toThrow('obsoleta')
    let currentSource: AIThread = { ...thread }
    const sourceBoundProposals = new WorkspaceWriteProposalService(planning, {
      getAIThread: (id) => Promise.resolve(id === currentSource.id ? currentSource : null),
      listAITurns: (threadId) => threadId === currentSource.id ? database.listAITurns(threadId) : Promise.resolve([])
    }, () => fixture, { inspectBaseline: () => Promise.resolve({ exists: false, hash: null }) })
    const expiring = await sourceBoundProposals.propose({ executionId: planned.execution.id, stepId: step.id, provider: thread.provider, threadId: thread.id, turnId: turn.id, toolCallId: crypto.randomUUID(), tool: 'workspace.write', relativePath: 'src/origem-expirada.ts', content: 'conteúdo que não pode ser consumido', operation: 'CREATE', targetBaselineHash: null })
    currentSource = { ...thread, provider: 'codex-app-server' }
    await expect(sourceBoundProposals.consume(expiring.id)).rejects.toThrow('obsoleta')
    await expect(sourceBoundProposals.consume(expiring.id)).rejects.toThrow('não está disponível')
  })

  it('aceita apenas uma proposta por chamada de ferramenta, inclusive sob concorrência', async () => {
    const now = new Date().toISOString()
    const thread = { id: 'thread-tool-call', provider: 'ollama' as const, workspaceRoot: fixture, model: 'modelo-teste', createdAt: now, updatedAt: now }
    const turn = { id: 'turn-tool-call', threadId: thread.id, mode: 'PLAN' as const, inputHash: 'c'.repeat(64), createdAt: now }
    await database.putAIThread(thread)
    await database.putAITurn(turn)
    const planning = new PlanApprovalService(database)
    const proposals = new WorkspaceWriteProposalService(planning, database, () => fixture, { inspectBaseline: () => Promise.resolve({ exists: false, hash: null }) })
    const planned = await planning.create('Impedir replay da chamada de ferramenta', fixture, 'PLAN')
    const step = planned.plan.steps.find((candidate) => candidate.requiresApproval)
    if (step === undefined) throw new Error('Fixture sem passo aprovável.')
    const input = { executionId: planned.execution.id, stepId: step.id, provider: thread.provider, threadId: thread.id, turnId: turn.id, toolCallId: crypto.randomUUID(), tool: 'workspace.write' as const, relativePath: 'src/tool-call.ts', content: 'payload efêmero', operation: 'CREATE' as const, targetBaselineHash: null }
    const attempts = await Promise.allSettled([proposals.propose(input), proposals.propose(input)])
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1)
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1)
    await expect(proposals.propose(input)).rejects.toThrow('já foi usada')
    expect((await planning.read(planned.execution.id)).plan.steps.find((candidate) => candidate.id === step.id)?.effects).toHaveLength(1)
  })

  it('exige baseline coerente e turno PLAN e não recupera payload após restart do serviço', async () => {
    const now = new Date().toISOString()
    const thread = { id: 'thread-restart', provider: 'ollama' as const, workspaceRoot: fixture, model: 'modelo-teste', createdAt: now, updatedAt: now }
    const planTurn = { id: 'turn-plan-restart', threadId: thread.id, mode: 'PLAN' as const, inputHash: 'e'.repeat(64), createdAt: now }
    const chatTurn = { ...planTurn, id: 'turn-chat-restart', mode: 'CHAT' as const }
    await database.putAIThread(thread)
    await database.putAITurn(planTurn)
    await database.putAITurn(chatTurn)
    const planning = new PlanApprovalService(database)
    const proposals = new WorkspaceWriteProposalService(planning, database, () => fixture, { inspectBaseline: () => Promise.resolve({ exists: false, hash: null }) })
    const planned = await planning.create('Validar baseline e payload efêmero', fixture, 'PLAN')
    const step = planned.plan.steps.find((candidate) => candidate.requiresApproval)
    if (step === undefined) throw new Error('Fixture sem passo aprovável.')
    const source = { executionId: planned.execution.id, stepId: step.id, provider: thread.provider, threadId: thread.id, tool: 'workspace.write' as const }

    await expect(proposals.propose({ ...source, turnId: planTurn.id, toolCallId: crypto.randomUUID(), relativePath: 'src/create-invalido.ts', content: 'x', operation: 'CREATE', targetBaselineHash: '1'.repeat(64) })).rejects.toThrow('baseline inexistente')
    await expect(proposals.propose({ ...source, turnId: planTurn.id, toolCallId: crypto.randomUUID(), relativePath: 'src/replace-invalido.ts', content: 'x', operation: 'REPLACE', targetBaselineHash: null })).rejects.toThrow('hash SHA-256')
    await expect(proposals.propose({ ...source, turnId: chatTurn.id, toolCallId: crypto.randomUUID(), relativePath: 'src/chat-invalido.ts', content: 'x', operation: 'CREATE', targetBaselineHash: null })).rejects.toThrow('modo PLAN')
    const privatePayload = 'payload-antigo-que-nao-pode-ser-persistido'
    const proposal = await proposals.propose({ ...source, turnId: planTurn.id, toolCallId: crypto.randomUUID(), relativePath: 'src/restart.ts', content: privatePayload, operation: 'CREATE', targetBaselineHash: null })
    const persisted = (await planning.read(planned.execution.id)).plan
    expect(JSON.stringify(persisted)).not.toContain(privatePayload)
    expect(persisted.steps.find((candidate) => candidate.id === step.id)?.effects[0]).toMatchObject({
      id: proposal.effect.id,
      expectedTargetHash: null,
      source: { kind: 'AGENT_PROPOSAL', proposalId: proposal.id, toolCallId: proposal.toolCallId }
    })
    const restarted = new WorkspaceWriteProposalService(new PlanApprovalService(database), database, () => fixture, { inspectBaseline: () => Promise.resolve({ exists: false, hash: null }) })
    await expect(restarted.consume(proposal.id)).rejects.toThrow('não está disponível')
    await expect(restarted.propose({ ...source, turnId: planTurn.id, toolCallId: proposal.toolCallId, relativePath: proposal.effect.target, content: privatePayload, operation: 'CREATE', targetBaselineHash: null })).rejects.toThrow('manifesto persistido')
  })

  it('invalida proposta quando workspace, alvo, hashes, origem ou turno derivam', async () => {
    const now = new Date().toISOString()
    const thread = { id: 'thread-drift', provider: 'ollama' as const, workspaceRoot: fixture, model: 'modelo-teste', createdAt: now, updatedAt: now }
    const turn = { id: 'turn-drift', threadId: thread.id, mode: 'PLAN' as const, inputHash: 'f'.repeat(64), createdAt: now }
    await database.putAIThread(thread)
    await database.putAITurn(turn)
    const planning = new PlanApprovalService(database)
    let activeWorkspaceRoot = fixture
    let activeTurns: AITurn[] = [turn]
    const proposals = new WorkspaceWriteProposalService(planning, {
      getAIThread: (id) => Promise.resolve(id === thread.id ? thread : null),
      listAITurns: (threadId) => Promise.resolve(threadId === thread.id ? activeTurns : [])
    }, () => activeWorkspaceRoot, { inspectBaseline: () => Promise.resolve({ exists: false, hash: null }) })
    const planned = await planning.create('Invalidar deriva de proposta', fixture, 'PLAN')
    const step = planned.plan.steps.find((candidate) => candidate.requiresApproval)
    if (step === undefined) throw new Error('Fixture sem passo aprovável.')
    const source = { executionId: planned.execution.id, stepId: step.id, provider: thread.provider, threadId: thread.id, turnId: turn.id, tool: 'workspace.write' as const }
    const createProposal = (suffix: string) => proposals.propose({ ...source, toolCallId: crypto.randomUUID(), relativePath: `src/drift-${suffix}.ts`, content: `conteúdo-${suffix}`, operation: 'CREATE', targetBaselineHash: null })

    const workspaceDrift = await createProposal('workspace')
    activeWorkspaceRoot = `${fixture}-outro`
    await expect(proposals.consume(workspaceDrift.id)).rejects.toThrow('obsoleta')
    activeWorkspaceRoot = fixture

    const targetDrift = await createProposal('target')
    let current = await planning.read(planned.execution.id)
    await planning.update(planned.execution.id, { ...current.plan, steps: current.plan.steps.map((candidate) => candidate.id === step.id ? { ...candidate, effects: candidate.effects.map((effect) => effect.id === targetDrift.effect.id ? { ...effect, target: 'src/alvo-derivado.ts' } : effect) } : candidate) })
    await expect(proposals.consume(targetDrift.id)).rejects.toThrow('obsoleta')

    const hashDrift = await proposals.propose({ ...source, toolCallId: crypto.randomUUID(), relativePath: 'src/drift-hash.ts', content: 'conteúdo-hash', operation: 'REPLACE', targetBaselineHash: '2'.repeat(64) })
    current = await planning.read(planned.execution.id)
    await planning.update(planned.execution.id, { ...current.plan, steps: current.plan.steps.map((candidate) => candidate.id === step.id ? { ...candidate, effects: candidate.effects.map((effect) => effect.id === hashDrift.effect.id ? { ...effect, payloadHash: '3'.repeat(64), expectedTargetHash: '4'.repeat(64) } : effect) } : candidate) })
    await expect(proposals.consume(hashDrift.id)).rejects.toThrow('obsoleta')

    const sourceDrift = await createProposal('source')
    current = await planning.read(planned.execution.id)
    await planning.update(planned.execution.id, { ...current.plan, steps: current.plan.steps.map((candidate) => candidate.id === step.id ? { ...candidate, effects: candidate.effects.map((effect) => effect.id === sourceDrift.effect.id && effect.source !== undefined ? { ...effect, source: { ...effect.source, toolCallId: crypto.randomUUID() } } : effect) } : candidate) })
    await expect(proposals.consume(sourceDrift.id)).rejects.toThrow('obsoleta')

    const turnDrift = await createProposal('turn')
    activeTurns = [{ ...turn, mode: 'CHAT' }]
    await expect(proposals.consume(turnDrift.id)).rejects.toThrow('obsoleta')
  })

  it('invalida aprovação quando uma proposta semanticamente idêntica recebe nova identidade', async () => {
    const now = new Date().toISOString()
    const thread = { id: 'thread-reapproval', provider: 'ollama' as const, workspaceRoot: fixture, model: 'modelo-teste', createdAt: now, updatedAt: now }
    const turn = { id: 'turn-reapproval', threadId: thread.id, mode: 'PLAN' as const, inputHash: '7'.repeat(64), createdAt: now }
    await database.putAIThread(thread)
    await database.putAITurn(turn)
    const planning = new PlanApprovalService(database)
    const proposals = new WorkspaceWriteProposalService(planning, database, () => fixture, { inspectBaseline: () => Promise.resolve({ exists: false, hash: null }) })
    const planned = await planning.create('Reaprovar nova identidade causal', fixture, 'PLAN')
    const step = planned.plan.steps.find((candidate) => candidate.requiresApproval)
    if (step === undefined) throw new Error('Fixture sem passo aprovável.')
    const common = { executionId: planned.execution.id, stepId: step.id, provider: thread.provider, threadId: thread.id, turnId: turn.id, tool: 'workspace.write' as const, relativePath: 'src/mesmo-efeito.ts', content: 'mesmo conteúdo', operation: 'CREATE' as const, targetBaselineHash: null }
    const first = await proposals.propose({ ...common, toolCallId: crypto.randomUUID() })
    await planning.decide(planned.execution.id, step.id, 'APPROVED', 'TASK')
    const replacement = await proposals.propose({ ...common, toolCallId: crypto.randomUUID() })
    expect(replacement.effect.id).not.toBe(first.effect.id)
    expect(replacement.effect.source?.proposalId).not.toBe(first.effect.source?.proposalId)
    await expect(planning.start(planned.execution.id)).rejects.toThrow('Aprovação pendente')
    await planning.decide(planned.execution.id, step.id, 'APPROVED', 'TASK')
    await expect(planning.start(planned.execution.id)).resolves.toMatchObject({ state: 'EXECUTION' })
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

  it('recusa CREATE quando o alvo já existe (baseline exists=true)', async () => {
    const now = new Date().toISOString()
    const thread = { id: 't-create-exists', provider: 'ollama' as const, workspaceRoot: fixture, model: 'm', createdAt: now, updatedAt: now }
    const turn = { id: 'turn-create', threadId: thread.id, mode: 'PLAN' as const, inputHash: 'c'.repeat(64), createdAt: now }
    await database.putAIThread(thread)
    await database.putAITurn(turn)
    const planning = new PlanApprovalService(database)
    const proposals = new WorkspaceWriteProposalService(planning, database, () => fixture, { inspectBaseline: () => Promise.resolve({ exists: true, hash: 'a'.repeat(64) }) })
    const planned = await planning.create('Teste CREATE alvo existente', fixture, 'PLAN')
    const step = planned.plan.steps.find((candidate) => candidate.requiresApproval)
    if (step === undefined) throw new Error('Fixture sem passo.')
    await expect(proposals.proposeFromEnvelope({
      envelope: { callId: crypto.randomUUID(), provider: 'ollama', threadId: thread.id, turnId: turn.id, tool: 'workspace.write', arguments: { relativePath: 'src/existente.ts', content: 'x', operation: 'CREATE' } },
      executionId: planned.execution.id,
      stepId: step.id
    })).rejects.toThrow('CREATE exige que o alvo não exista')
  })

  it('recusa REPLACE quando o alvo não existe (baseline exists=false)', async () => {
    const now = new Date().toISOString()
    const thread = { id: 't-replace-missing', provider: 'ollama' as const, workspaceRoot: fixture, model: 'm', createdAt: now, updatedAt: now }
    const turn = { id: 'turn-replace', threadId: thread.id, mode: 'PLAN' as const, inputHash: 'd'.repeat(64), createdAt: now }
    await database.putAIThread(thread)
    await database.putAITurn(turn)
    const planning = new PlanApprovalService(database)
    const proposals = new WorkspaceWriteProposalService(planning, database, () => fixture, { inspectBaseline: () => Promise.resolve({ exists: false, hash: null }) })
    const planned = await planning.create('Teste REPLACE alvo inexistente', fixture, 'PLAN')
    const step = planned.plan.steps.find((candidate) => candidate.requiresApproval)
    if (step === undefined) throw new Error('Fixture sem passo.')
    await expect(proposals.proposeFromEnvelope({
      envelope: { callId: crypto.randomUUID(), provider: 'ollama', threadId: thread.id, turnId: turn.id, tool: 'workspace.write', arguments: { relativePath: 'src/inexistente.ts', content: 'x', operation: 'REPLACE' } },
      executionId: planned.execution.id,
      stepId: step.id
    })).rejects.toThrow('REPLACE exige um arquivo existente')
  })

  it('lookupStatus retorna EXPIRED quando proposta é substituída', async () => {
    const now = new Date().toISOString()
    const thread = { id: 't-expired', provider: 'ollama' as const, workspaceRoot: fixture, model: 'm', createdAt: now, updatedAt: now }
    const turn = { id: 'turn-expired', threadId: thread.id, mode: 'PLAN' as const, inputHash: 'e'.repeat(64), createdAt: now }
    await database.putAIThread(thread)
    await database.putAITurn(turn)
    const planning = new PlanApprovalService(database)
    const proposals = new WorkspaceWriteProposalService(planning, database, () => fixture, { inspectBaseline: () => Promise.resolve({ exists: false, hash: null }) })
    const planned = await planning.create('Teste EXPIRED', fixture, 'PLAN')
    const step = planned.plan.steps.find((candidate) => candidate.requiresApproval)
    if (step === undefined) throw new Error('Fixture sem passo.')
    const first = await proposals.propose({ executionId: planned.execution.id, stepId: step.id, provider: thread.provider, threadId: thread.id, turnId: turn.id, toolCallId: crypto.randomUUID(), tool: 'workspace.write', relativePath: 'src/primeira.ts', content: 'primeira', operation: 'CREATE', targetBaselineHash: null })
    expect(await proposals.lookupStatus(first.id)).toBe('PENDING_REVIEW')
    const second = await proposals.propose({ executionId: planned.execution.id, stepId: step.id, provider: thread.provider, threadId: thread.id, turnId: turn.id, toolCallId: crypto.randomUUID(), tool: 'workspace.write', relativePath: 'src/segunda.ts', content: 'segunda', operation: 'CREATE', targetBaselineHash: null })
    expect(await proposals.lookupStatus(first.id)).toBe('EXPIRED')
    expect(await proposals.lookupStatus(second.id)).toBe('PENDING_REVIEW')
  })

  it('lookupStatus retorna EXPIRED quando workspace muda', async () => {
    const now = new Date().toISOString()
    const thread = { id: 't-ws-drift', provider: 'ollama' as const, workspaceRoot: fixture, model: 'm', createdAt: now, updatedAt: now }
    const turn = { id: 'turn-ws', threadId: thread.id, mode: 'PLAN' as const, inputHash: 'f'.repeat(64), createdAt: now }
    await database.putAIThread(thread)
    await database.putAITurn(turn)
    const planning = new PlanApprovalService(database)
    const proposals = new WorkspaceWriteProposalService(planning, database, () => fixture, { inspectBaseline: () => Promise.resolve({ exists: false, hash: null }) })
    const planned = await planning.create('Teste workspace drift', fixture, 'PLAN')
    const step = planned.plan.steps.find((candidate) => candidate.requiresApproval)
    if (step === undefined) throw new Error('Fixture sem passo.')
    const proposal = await proposals.propose({ executionId: planned.execution.id, stepId: step.id, provider: thread.provider, threadId: thread.id, turnId: turn.id, toolCallId: crypto.randomUUID(), tool: 'workspace.write', relativePath: 'src/drift.ts', content: 'x', operation: 'CREATE', targetBaselineHash: null })
    expect(await proposals.lookupStatus(proposal.id)).toBe('PENDING_REVIEW')
    const wsChanged = new WorkspaceWriteProposalService(planning, database, () => '/outro/workspace', { inspectBaseline: () => Promise.resolve({ exists: false, hash: null }) })
    expect(await wsChanged.lookupStatus(proposal.id)).toBe('EXPIRED')
  })

  it('lookupStatus retorna EXPIRED quando thread muda', async () => {
    const now = new Date().toISOString()
    const thread = { id: 't-thread-drift', provider: 'ollama' as const, workspaceRoot: fixture, model: 'm', createdAt: now, updatedAt: now }
    const turn = { id: 'turn-td', threadId: thread.id, mode: 'PLAN' as const, inputHash: '10'.repeat(32), createdAt: now }
    await database.putAIThread(thread)
    await database.putAITurn(turn)
    const planning = new PlanApprovalService(database)
    const proposals = new WorkspaceWriteProposalService(planning, database, () => fixture, { inspectBaseline: () => Promise.resolve({ exists: false, hash: null }) })
    const planned = await planning.create('Teste thread drift', fixture, 'PLAN')
    const step = planned.plan.steps.find((candidate) => candidate.requiresApproval)
    if (step === undefined) throw new Error('Fixture sem passo.')
    const proposal = await proposals.propose({ executionId: planned.execution.id, stepId: step.id, provider: thread.provider, threadId: thread.id, turnId: turn.id, toolCallId: crypto.randomUUID(), tool: 'workspace.write', relativePath: 'src/tdrift.ts', content: 'x', operation: 'CREATE', targetBaselineHash: null })
    await database.putAIThread({ ...thread, id: 'outra-thread', provider: 'codex-app-server' })
    expect(await proposals.lookupStatus(proposal.id)).toBe('EXPIRED')
  })

  it('consume remove payload da memória ao expirar', async () => {
    const now = new Date().toISOString()
    const thread = { id: 't-purge', provider: 'ollama' as const, workspaceRoot: fixture, model: 'm', createdAt: now, updatedAt: now }
    const turn = { id: 'turn-purge', threadId: thread.id, mode: 'PLAN' as const, inputHash: '11'.repeat(32), createdAt: now }
    await database.putAIThread(thread)
    await database.putAITurn(turn)
    const planning = new PlanApprovalService(database)
    const proposals = new WorkspaceWriteProposalService(planning, database, () => fixture, { inspectBaseline: () => Promise.resolve({ exists: false, hash: null }) })
    const planned = await planning.create('Teste purge', fixture, 'PLAN')
    const step = planned.plan.steps.find((candidate) => candidate.requiresApproval)
    if (step === undefined) throw new Error('Fixture sem passo.')
    const proposal = await proposals.propose({ executionId: planned.execution.id, stepId: step.id, provider: thread.provider, threadId: thread.id, turnId: turn.id, toolCallId: crypto.randomUUID(), tool: 'workspace.write', relativePath: 'src/purge.ts', content: 'conteudo-privado', operation: 'CREATE', targetBaselineHash: null })
    await expect(proposals.consume(proposal.id)).resolves.toMatchObject({ content: 'conteudo-privado' })
    // After consuming, proposal should be consumed
    await expect(proposals.consume(proposal.id)).rejects.toThrow('não está disponível')
  })
})
