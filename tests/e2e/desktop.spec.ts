import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { _electron as electron, expect, test } from '@playwright/test'

const execFileAsync = promisify(execFile)

test('inicia o Electron seguro e carrega um workspace real', async () => {
  const projectRoot = process.cwd()
  const application = await electron.launch({
    args: ['.'],
    cwd: projectRoot,
    timeout: 180_000,
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' }
  })
  const processErrors: string[] = []
  application.process().stderr?.on('data', (chunk: Buffer) => processErrors.push(chunk.toString('utf8')))
  let workspaceRoot = ''

  try {
    const temp = process.env.TEMP
    if (temp === undefined || path.parse(temp).root.toUpperCase() !== 'D:\\') throw new Error('TEMP de E2E precisa estar em D:.')
    workspaceRoot = await mkdtemp(path.join(temp, 'tupiniquim-e2e-'))
    await writeFile(path.join(workspaceRoot, 'README.md'), '# Workspace E2E\n', 'utf8')
    await execFileAsync('git', ['init', '--quiet'], { cwd: workspaceRoot })
    const page = await application.firstWindow({ timeout: 180_000 }).catch((cause: unknown) => {
      const detail = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`${detail}\nElectron stderr:\n${processErrors.join('')}`)
    })
    const rendererErrors: string[] = []
    page.on('pageerror', (error) => rendererErrors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') rendererErrors.push(message.text()) })
    await expect(page).toHaveTitle('Tupiniquim AI Dev Studio')
    await expect(page.locator('.studio'), `Renderer errors: ${rendererErrors.join(' | ')}`).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText('Engenharia com')).toBeVisible()
    await page.getByLabel('Provedor de IA').selectOption('ollama')
    await expect(page.getByText('Ollama usa somente o loopback local')).toBeVisible()
    const providerStatus = await page.evaluate(async () => window.studio.agent.status())
    expect(providerStatus).toMatchObject({ ok: true, value: { provider: 'ollama' } })

    const configured = await page.evaluate(async (root) => window.studio.workspace.configure({ root }), workspaceRoot)
    expect(configured.ok).toBe(true)
    const context = await page.evaluate(async () => window.studio.workspace.context())
    expect(context).toMatchObject({ ok: true, value: { contentPolicy: 'METADATA_ONLY' } })
    if (context.ok) {
      expect(context.value.entries.length).toBeGreaterThan(0)
      expect(JSON.stringify(context.value)).not.toContain('node_modules')
    }
    const emptyHistory = await page.evaluate(async () => window.studio.agent.history({ threadId: 'thread-inexistente' }))
    if (!emptyHistory.ok) throw new Error(emptyHistory.error.message)
    expect(emptyHistory).toMatchObject({ ok: true, value: { thread: null, turns: [], events: [] } })
    const tree = await page.evaluate(async () => window.studio.workspace.list({ relativePath: '', depth: 2 }))
    expect(tree.ok).toBe(true)
    const blockedWrite = await page.evaluate(async () => window.studio.workspace.write({ relativePath: '.agent-policy-probe', content: 'não deve gravar' }))
    expect(blockedWrite).toMatchObject({ ok: false, error: { code: 'APPROVAL_REQUIRED' } })
    const terminalPolicy = await page.evaluate(async () => {
      const created = await window.studio.terminal.create({ cwd: '', cols: 80, rows: 24 })
      if (!created.ok) return created
      const blocked = await window.studio.terminal.write({ terminalId: created.value.terminalId, data: 'git reset --hard HEAD\r' })
      await window.studio.terminal.kill({ terminalId: created.value.terminalId })
      return blocked
    })
    expect(terminalPolicy).toMatchObject({ ok: false, error: { code: 'POLICY_DENIED' } })
    const content = 'Conteúdo materializado por efeito aprovado.\n'
    const payloadHash = createHash('sha256').update(content).digest('hex')
    const executionEvidence = await page.evaluate(async ({ content, payloadHash }) => {
      const created = await window.studio.planning.create({ objective: 'Registrar baseline sem mutar o workspace', mode: 'PLAN' })
      if (!created.ok) throw new Error(created.error.message)
      const writeStep = created.value.plan.steps.find((step) => step.requiresApproval)
      if (writeStep === undefined) throw new Error('Plano sem passo de escrita aprovável.')
      const plan = {
        ...created.value.plan,
        steps: created.value.plan.steps.map((step, index) => step.requiresApproval ? {
          ...step,
          effects: [{
            id: crypto.randomUUID(),
            capability: 'workspace.write' as const,
            operation: 'CREATE' as const,
            target: step.id === writeStep.id ? 'materializado-pelo-plano.txt' : `.agent-effect-${String(index)}.md`,
            payloadHash: step.id === writeStep.id ? payloadHash : String(index + 1).repeat(64),
            risk: 'HIGH' as const
          }]
        } : step)
      }
      const updated = await window.studio.planning.update({ executionId: created.value.execution.id, plan })
      if (!updated.ok) throw new Error(updated.error.message)
      for (const step of updated.value.steps.filter((candidate) => candidate.requiresApproval)) {
        const approval = await window.studio.planning.decide({ executionId: created.value.execution.id, stepId: step.id, decision: 'APPROVED', scope: 'TASK' })
        if (!approval.ok) throw new Error(approval.error.message)
      }
      const started = await window.studio.planning.start({ executionId: created.value.execution.id })
      if (!started.ok) throw new Error(started.error.message)
      const materializedStep = updated.value.steps.find((step) => step.id === writeStep.id)
      const effect = materializedStep?.effects[0]
      if (materializedStep === undefined || effect === undefined) throw new Error('Manifesto de escrita ausente.')
      const targetMismatch = await window.studio.planning.applyWorkspaceWrite({ executionId: created.value.execution.id, stepId: materializedStep.id, effectId: effect.id, relativePath: 'outro-alvo.txt', content })
      const hashMismatch = await window.studio.planning.applyWorkspaceWrite({ executionId: created.value.execution.id, stepId: materializedStep.id, effectId: effect.id, relativePath: effect.target, content: `${content}divergente` })
      const applied = await window.studio.planning.applyWorkspaceWrite({ executionId: created.value.execution.id, stepId: materializedStep.id, effectId: effect.id, relativePath: effect.target, content })
      const repeated = await window.studio.planning.applyWorkspaceWrite({ executionId: created.value.execution.id, stepId: materializedStep.id, effectId: effect.id, relativePath: effect.target, content })
      const events = await window.studio.planning.events({ executionId: created.value.execution.id })
      if (!events.ok) throw new Error(events.error.message)
      return { state: started.value.state, categories: events.value.map((event) => event.category), targetMismatch, hashMismatch, applied, repeated }
    }, { content, payloadHash })
    expect(executionEvidence.state).toBe('EXECUTION')
    expect(executionEvidence.categories).toEqual(expect.arrayContaining(['TOOL', 'GIT']))
    expect(executionEvidence.targetMismatch).toMatchObject({ ok: false })
    expect(executionEvidence.hashMismatch).toMatchObject({ ok: false })
    expect(executionEvidence.applied).toMatchObject({ ok: true, value: { relativePath: 'materializado-pelo-plano.txt', hash: payloadHash } })
    expect(executionEvidence.repeated).toMatchObject({ ok: false })
    await expect(readFile(path.join(workspaceRoot, 'materializado-pelo-plano.txt'), 'utf8')).resolves.toBe(content)

    await page.screenshot({ path: path.join(projectRoot, 'test-results', 'hud-foundation.png'), fullPage: true })

    const webPreferences = await application.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      if (window === undefined) return undefined
      const webContents = window.webContents as typeof window.webContents & {
        getLastWebPreferences: () => {
          contextIsolation?: boolean
          nodeIntegration?: boolean
          sandbox?: boolean
        }
      }
      return webContents.getLastWebPreferences()
    })
    expect(webPreferences?.nodeIntegration).toBe(false)
    expect(webPreferences?.contextIsolation).toBe(true)
    expect(webPreferences?.sandbox).toBe(true)
  } finally {
    await application.close()
    if (workspaceRoot !== '') await rm(workspaceRoot, { recursive: true, force: true })
  }
})
