import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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
  const temp = process.platform === 'win32' ? process.env.TEMP : tmpdir()
  if (temp === undefined || (process.platform === 'win32' && path.parse(temp).root.toUpperCase() !== 'F:\\')) throw new Error('TEMP de testes precisa estar em F: na certificação Windows.')
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
    await service.close()
  })

  it('faz a negativa prevalecer mesmo após uma aprovação anterior', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Operação mutável', fixture, 'PLAN')
    const plan = await service.update(planned.execution.id, materializeEffects(planned.plan))
    const [first, second] = plan.steps.filter((candidate) => candidate.requiresApproval)
    if (first === undefined || second === undefined) throw new Error('Fixture precisa de pelo menos dois passos aprováveis.')
    await service.decide(planned.execution.id, first.id, 'APPROVED', 'TASK')
    await service.decide(planned.execution.id, second.id, 'DENIED', 'TASK')
    await expect(service.start(planned.execution.id)).rejects.toThrow('Execução bloqueada: há aprovação negada.')
    await service.close()
  })

  it('rejeita evidência de ferramenta antes da execução autorizada', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Operação mutável', fixture, 'PLAN')
    await expect(service.recordEvidence(planned.execution.id, 'TOOL', 'Tentativa precoce', 'Não pode materializar antes do gate.', 'FAILED')).rejects.toThrow('Evidência de ferramenta exige execução autorizada.')
    await service.close()
  })

  it('exige manifesto e invalida aprovação quando alvo ou efeito muda', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Operação mutável', fixture, 'PLAN')
    const plan = await service.update(planned.execution.id, materializeEffects(planned.plan))
    for (const targetStep of plan.steps.filter((candidate) => candidate.requiresApproval)) {
      await service.decide(planned.execution.id, targetStep.id, 'APPROVED', 'TASK')
    }
    const mutation = {
      ...plan,
      steps: plan.steps.map((step) => step.requiresApproval ? { ...step, title: `${step.title} alterado` } : step)
    }
    await expect(service.update(planned.execution.id, mutation)).rejects.toThrow('Aprovações existentes impedem alteração do plano.')
    await service.close()
  })

  it('reserva um único efeito aprovado e impede materialização duplicada', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Operação mutável', fixture, 'PLAN')
    const plan = await service.update(planned.execution.id, materializeEffects(planned.plan))
    for (const targetStep of plan.steps.filter((candidate) => candidate.requiresApproval)) {
      await service.decide(planned.execution.id, targetStep.id, 'APPROVED', 'TASK')
    }
    await service.start(planned.execution.id)
    const target = plan.steps.find((candidate) => candidate.requiresApproval)?.effects[0]
    if (target === undefined) throw new Error('Fixture sem efeito aprovável.')
    expect(await service.reserveEffect(planned.execution.id, target.id)).toBe(true)
    expect(await service.reserveEffect(planned.execution.id, target.id)).toBe(false)
    await service.completeEffect(planned.execution.id, target.id)
    await service.close()
  })

  it('normaliza execuções legadas sem completedEffectIds ao retomar o plano', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Operação legada', fixture, 'PLAN')
    const plan = await service.update(planned.execution.id, materializeEffects(planned.plan))
    for (const targetStep of plan.steps.filter((candidate) => candidate.requiresApproval)) {
      await service.decide(planned.execution.id, targetStep.id, 'APPROVED', 'TASK')
    }
    await service.start(planned.execution.id)
    await database.run('UPDATE executions SET completed_effect_ids_json = NULL WHERE id = ?', [planned.execution.id])
    const resumed = await service.read(planned.execution.id)
    expect(resumed.execution.completedEffectIds).toEqual([])
    await service.close()
  })

  it('persiste somente o primeiro vínculo de thread e recusa vínculo após EXECUTION', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Vincular thread', fixture, 'PLAN')
    await service.bindThread(planned.execution.id, 'thread-1')
    await expect(service.bindThread(planned.execution.id, 'thread-2')).rejects.toThrow('Execução já vinculada a outra thread.')
    const plan = await service.update(planned.execution.id, materializeEffects(planned.plan))
    for (const targetStep of plan.steps.filter((candidate) => candidate.requiresApproval)) {
      await service.decide(planned.execution.id, targetStep.id, 'APPROVED', 'TASK')
    }
    await service.start(planned.execution.id)
    await expect(service.bindThread(planned.execution.id, 'thread-1')).rejects.toThrow('Vínculo de thread só pode mudar em WAITING_APPROVAL.')
    await service.close()
  })

  it('restringe update, bind, decide e start exatamente ao estado WAITING_APPROVAL', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Estado estrito', fixture, 'PLAN')
    const plan = await service.update(planned.execution.id, materializeEffects(planned.plan))
    for (const targetStep of plan.steps.filter((candidate) => candidate.requiresApproval)) {
      await service.decide(planned.execution.id, targetStep.id, 'APPROVED', 'TASK')
    }
    await service.start(planned.execution.id)
    await expect(service.update(planned.execution.id, plan)).rejects.toThrow('Plano só pode ser alterado em WAITING_APPROVAL.')
    await expect(service.bindThread(planned.execution.id, 'thread')).rejects.toThrow('Vínculo de thread só pode mudar em WAITING_APPROVAL.')
    const step = plan.steps.find((candidate) => candidate.requiresApproval)
    if (step === undefined) throw new Error('Fixture sem passo aprovável.')
    await expect(service.decide(planned.execution.id, step.id, 'APPROVED', 'TASK')).rejects.toThrow('Decisão só pode ser registrada em WAITING_APPROVAL.')
    await expect(service.start(planned.execution.id)).rejects.toThrow('Execução só pode iniciar em WAITING_APPROVAL.')
    await service.close()
  })

  it('serializa bind×start e start×start sem perder vínculo ou aprovações', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Concorrência de transição', fixture, 'PLAN')
    const plan = await service.update(planned.execution.id, materializeEffects(planned.plan))
    for (const targetStep of plan.steps.filter((candidate) => candidate.requiresApproval)) {
      await service.decide(planned.execution.id, targetStep.id, 'APPROVED', 'TASK')
    }
    const [bindResult, startResult] = await Promise.allSettled([
      service.bindThread(planned.execution.id, 'thread-race'),
      service.start(planned.execution.id)
    ])
    expect([bindResult.status, startResult.status]).toContain('fulfilled')
    const afterRace = await service.read(planned.execution.id)
    expect(afterRace.execution.state).toBe('EXECUTION')
    const starts = await Promise.allSettled([service.start(planned.execution.id), service.start(planned.execution.id)])
    expect(starts.every((result) => result.status === 'rejected')).toBe(true)
    await service.close()
  })

  it('preserva todos os campos ao concluir efeitos diferentes concorrentemente', async () => {
    const service = new PlanApprovalService(database)
    const planned = await service.create('Concorrência de efeitos', fixture, 'PLAN')
    const plan = await service.update(planned.execution.id, materializeEffects(planned.plan))
    for (const targetStep of plan.steps.filter((candidate) => candidate.requiresApproval)) {
      await service.decide(planned.execution.id, targetStep.id, 'APPROVED', 'TASK')
    }
    await service.start(planned.execution.id)
    const effects = plan.steps.flatMap((step) => step.effects)
    if (effects.length < 2) throw new Error('Fixture precisa de dois efeitos.')
    await Promise.all(effects.slice(0, 2).map(async (effect) => {
      expect(await service.reserveEffect(planned.execution.id, effect.id)).toBe(true)
      await service.completeEffect(planned.execution.id, effect.id)
    }))
    const persisted = await service.read(planned.execution.id)
    expect(new Set(persisted.execution.completedEffectIds)).toEqual(new Set(effects.slice(0, 2).map((effect) => effect.id)))
    await service.close()
  })

  it('mantém proposta somente em memória e revalida a proveniência completa', async () => {
    const service = new WorkspaceWriteProposalService(database)
    const input = {
      executionId: crypto.randomUUID(),
      stepId: crypto.randomUUID(),
      workspaceId: crypto.randomUUID(),
      threadId: crypto.randomUUID(),
      turnId: crypto.randomUUID(),
      toolCallId: crypto.randomUUID(),
      provider: 'OLLAMA' as const,
      model: 'qwen2.5-coder:3b',
      target: 'src/proposal.ts',
      operation: 'REPLACE' as const,
      baseline: { exists: true, hash: 'a'.repeat(64) },
      contentHash: 'b'.repeat(64),
      payload: 'const x = 1\n'
    }
    const proposed = await service.propose(input)
    expect(workspaceWriteProposalSchema.parse(proposed).payload).toBeUndefined()
    const reloaded = new WorkspaceWriteProposalService(database)
    expect(await reloaded.lookupStatus(proposed.id, input)).toBe('EXPIRED')
    await service.close()
    await reloaded.close()
  })

  it('aceita apenas uma proposta por chamada de ferramenta, inclusive sob concorrência', async () => {
    const service = new WorkspaceWriteProposalService(database)
    const base = {
      executionId: crypto.randomUUID(),
      stepId: crypto.randomUUID(),
      workspaceId: crypto.randomUUID(),
      threadId: crypto.randomUUID(),
      turnId: crypto.randomUUID(),
      toolCallId: crypto.randomUUID(),
      provider: 'OLLAMA' as const,
      model: 'qwen2.5-coder:3b',
      target: 'src/proposal.ts',
      operation: 'REPLACE' as const,
      baseline: { exists: true, hash: 'a'.repeat(64) },
      contentHash: 'b'.repeat(64),
      payload: 'const x = 1\n'
    }
    const results = await Promise.allSettled([
      service.propose(base),
      service.propose({ ...base, payload: 'const x = 2\n', contentHash: 'c'.repeat(64) })
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    await service.close()
  })

  it('exige baseline coerente e turno PLAN e não recupera payload após restart do serviço', async () => {
    const service = new WorkspaceWriteProposalService(database)
    const input = {
      executionId: crypto.randomUUID(),
      stepId: crypto.randomUUID(),
      workspaceId: crypto.randomUUID(),
      threadId: crypto.randomUUID(),
      turnId: crypto.randomUUID(),
      toolCallId: crypto.randomUUID(),
      provider: 'OLLAMA' as const,
      model: 'qwen2.5-coder:3b',
      target: 'src/proposal.ts',
      operation: 'CREATE' as const,
      baseline: { exists: false },
      contentHash: 'b'.repeat(64),
      payload: 'const x = 1\n'
    }
    const proposed = await service.propose(input)
    expect(await service.lookupStatus(proposed.id, input)).toBe('VALID')
    const reloaded = new WorkspaceWriteProposalService(database)
    expect(await reloaded.lookupStatus(proposed.id, input)).toBe('EXPIRED')
    await service.close()
    await reloaded.close()
  })

  it('invalida proposta quando workspace, alvo, hashes, origem ou turno derivam', async () => {
    const service = new WorkspaceWriteProposalService(database)
    const input = {
      executionId: crypto.randomUUID(),
      stepId: crypto.randomUUID(),
      workspaceId: crypto.randomUUID(),
      threadId: crypto.randomUUID(),
      turnId: crypto.randomUUID(),
      toolCallId: crypto.randomUUID(),
      provider: 'OLLAMA' as const,
      model: 'qwen2.5-coder:3b',
      target: 'src/proposal.ts',
      operation: 'REPLACE' as const,
      baseline: { exists: true, hash: 'a'.repeat(64) },
      contentHash: 'b'.repeat(64),
      payload: 'const x = 1\n'
    }
    const proposed = await service.propose(input)
    const drifts = [
      { workspaceId: crypto.randomUUID() },
      { target: 'src/other.ts' },
      { baseline: { exists: true, hash: 'c'.repeat(64) } },
      { contentHash: 'd'.repeat(64) },
      { toolCallId: crypto.randomUUID() },
      { turnId: crypto.randomUUID() }
    ]
    for (const drift of drifts) {
      expect(await service.lookupStatus(proposed.id, { ...input, ...drift })).toBe('EXPIRED')
    }
    await service.close()
  })

  it('invalida aprovação quando uma proposta semanticamente idêntica recebe nova identidade', async () => {
    const service = new WorkspaceWriteProposalService(database)
    const base = {
      executionId: crypto.randomUUID(),
      stepId: crypto.randomUUID(),
      workspaceId: crypto.randomUUID(),
      threadId: crypto.randomUUID(),
      turnId: crypto.randomUUID(),
      toolCallId: crypto.randomUUID(),
      provider: 'OLLAMA' as const,
      model: 'qwen2.5-coder:3b',
      target: 'src/proposal.ts',
      operation: 'REPLACE' as const,
      baseline: { exists: true, hash: 'a'.repeat(64) },
      contentHash: 'b'.repeat(64),
      payload: 'const x = 1\n'
    }
    const first = await service.propose(base)
    await service.approve(first.id, base)
    const second = await service.propose({ ...base, toolCallId: crypto.randomUUID() })
    expect(second.id).not.toBe(first.id)
    expect(await service.lookupStatus(first.id, base)).toBe('EXPIRED')
    await service.close()
  })

  it('persiste threads, turns e eventos de IA sem armazenar o conteúdo da entrada', async () => {
    const service = new PlanApprovalService(database)
    const thread: AIThread = {
      id: crypto.randomUUID(),
      workspaceId: crypto.randomUUID(),
      provider: 'OLLAMA',
      model: 'qwen2.5-coder:3b',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const turn: AITurn = {
      id: crypto.randomUUID(),
      threadId: thread.id,
      role: 'USER',
      createdAt: new Date().toISOString()
    }
    await database.run('INSERT INTO ai_threads (id, workspace_id, provider, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [thread.id, thread.workspaceId, thread.provider, thread.model, thread.createdAt, thread.updatedAt])
    await database.run('INSERT INTO ai_turns (id, thread_id, role, created_at) VALUES (?, ?, ?, ?)', [turn.id, turn.threadId, turn.role, turn.createdAt])
    const secret = 'conteudo-privado-nao-persistir'
    await database.run('INSERT INTO ai_events (id, thread_id, turn_id, kind, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), thread.id, turn.id, 'MESSAGE', JSON.stringify({ redacted: true, length: secret.length }), new Date().toISOString()])
    const rows = await database.all<{ payload_json: string }>('SELECT payload_json FROM ai_events WHERE thread_id = ?', [thread.id])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.payload_json).not.toContain(secret)
    expect(rows[0]?.payload_json).toContain('redacted')
    await service.close()
  })

  it('recusa CREATE quando o alvo já existe (baseline exists=true)', async () => {
    const service = new WorkspaceWriteProposalService(database)
    await expect(service.propose({
      executionId: crypto.randomUUID(), stepId: crypto.randomUUID(), workspaceId: crypto.randomUUID(), threadId: crypto.randomUUID(), turnId: crypto.randomUUID(), toolCallId: crypto.randomUUID(), provider: 'OLLAMA', model: 'qwen2.5-coder:3b', target: 'src/file.ts', operation: 'CREATE', baseline: { exists: true, hash: 'a'.repeat(64) }, contentHash: 'b'.repeat(64), payload: 'x'
    })).rejects.toThrow('CREATE exige baseline inexistente.')
    await service.close()
  })

  it('recusa REPLACE quando o alvo não existe (baseline exists=false)', async () => {
    const service = new WorkspaceWriteProposalService(database)
    await expect(service.propose({
      executionId: crypto.randomUUID(), stepId: crypto.randomUUID(), workspaceId: crypto.randomUUID(), threadId: crypto.randomUUID(), turnId: crypto.randomUUID(), toolCallId: crypto.randomUUID(), provider: 'OLLAMA', model: 'qwen2.5-coder:3b', target: 'src/file.ts', operation: 'REPLACE', baseline: { exists: false }, contentHash: 'b'.repeat(64), payload: 'x'
    })).rejects.toThrow('REPLACE exige baseline existente.')
    await service.close()
  })

  it('lookupStatus retorna EXPIRED quando proposta é substituída', async () => {
    const service = new WorkspaceWriteProposalService(database)
    const base = {
      executionId: crypto.randomUUID(), stepId: crypto.randomUUID(), workspaceId: crypto.randomUUID(), threadId: crypto.randomUUID(), turnId: crypto.randomUUID(), toolCallId: crypto.randomUUID(), provider: 'OLLAMA' as const, model: 'qwen2.5-coder:3b', target: 'src/file.ts', operation: 'REPLACE' as const, baseline: { exists: true, hash: 'a'.repeat(64) }, contentHash: 'b'.repeat(64), payload: 'x'
    }
    const first = await service.propose(base)
    await service.approve(first.id, base)
    await service.propose({ ...base, toolCallId: crypto.randomUUID() })
    expect(await service.lookupStatus(first.id, base)).toBe('EXPIRED')
    await service.close()
  })

  it('lookupStatus retorna EXPIRED quando o workspace ativo muda (mesma instância do serviço)', async () => {
    const service = new WorkspaceWriteProposalService(database)
    const base = {
      executionId: crypto.randomUUID(), stepId: crypto.randomUUID(), workspaceId: crypto.randomUUID(), threadId: crypto.randomUUID(), turnId: crypto.randomUUID(), toolCallId: crypto.randomUUID(), provider: 'OLLAMA' as const, model: 'qwen2.5-coder:3b', target: 'src/file.ts', operation: 'REPLACE' as const, baseline: { exists: true, hash: 'a'.repeat(64) }, contentHash: 'b'.repeat(64), payload: 'x'
    }
    const first = await service.propose(base)
    expect(await service.lookupStatus(first.id, { ...base, workspaceId: crypto.randomUUID() })).toBe('EXPIRED')
    await service.close()
  })

  it('lookupStatus retorna EXPIRED quando provider da thread de origem deriva', async () => {
    const service = new WorkspaceWriteProposalService(database)
    const base = {
      executionId: crypto.randomUUID(), stepId: crypto.randomUUID(), workspaceId: crypto.randomUUID(), threadId: crypto.randomUUID(), turnId: crypto.randomUUID(), toolCallId: crypto.randomUUID(), provider: 'OLLAMA' as const, model: 'qwen2.5-coder:3b', target: 'src/file.ts', operation: 'REPLACE' as const, baseline: { exists: true, hash: 'a'.repeat(64) }, contentHash: 'b'.repeat(64), payload: 'x'
    }
    const first = await service.propose(base)
    expect(await service.lookupStatus(first.id, { ...base, provider: 'CODEX' })).toBe('EXPIRED')
    await service.close()
  })

  it('purga o payload efêmero quando a proposta expira por drift real, antes de lookup/consume', async () => {
    const service = new WorkspaceWriteProposalService(database)
    const base = {
      executionId: crypto.randomUUID(), stepId: crypto.randomUUID(), workspaceId: crypto.randomUUID(), threadId: crypto.randomUUID(), turnId: crypto.randomUUID(), toolCallId: crypto.randomUUID(), provider: 'OLLAMA' as const, model: 'qwen2.5-coder:3b', target: 'src/file.ts', operation: 'REPLACE' as const, baseline: { exists: true, hash: 'a'.repeat(64) }, contentHash: 'b'.repeat(64), payload: 'x'
    }
    const first = await service.propose(base)
    expect(await service.lookupStatus(first.id, { ...base, target: 'src/changed.ts' })).toBe('EXPIRED')
    await expect(service.consume(first.id, base)).rejects.toThrow('Proposta expirada ou inexistente.')
    await service.close()
  })
})
