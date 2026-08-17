import path from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

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

  try {
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

    const configured = await page.evaluate(async (root) => window.studio.workspace.configure({ root }), projectRoot)
    expect(configured.ok).toBe(true)
    const context = await page.evaluate(async () => window.studio.workspace.context())
    expect(context).toMatchObject({ ok: true, value: { contentPolicy: 'METADATA_ONLY' } })
    if (context.ok) {
      expect(context.value.entries.length).toBeGreaterThan(0)
      expect(JSON.stringify(context.value)).not.toContain('node_modules')
    }
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
    const executionEvidence = await page.evaluate(async () => {
      const created = await window.studio.planning.create({ objective: 'Registrar baseline sem mutar o workspace', mode: 'PLAN' })
      if (!created.ok) throw new Error(created.error.message)
      for (const step of created.value.plan.steps.filter((candidate) => candidate.requiresApproval)) {
        const approval = await window.studio.planning.decide({ executionId: created.value.execution.id, stepId: step.id, decision: 'APPROVED', scope: 'TASK' })
        if (!approval.ok) throw new Error(approval.error.message)
      }
      const started = await window.studio.planning.start({ executionId: created.value.execution.id })
      if (!started.ok) throw new Error(started.error.message)
      const events = await window.studio.planning.events({ executionId: created.value.execution.id })
      if (!events.ok) throw new Error(events.error.message)
      return { state: started.value.state, categories: events.value.map((event) => event.category) }
    })
    expect(executionEvidence.state).toBe('EXECUTION')
    expect(executionEvidence.categories).toEqual(expect.arrayContaining(['TOOL', 'GIT']))

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
  }
})
