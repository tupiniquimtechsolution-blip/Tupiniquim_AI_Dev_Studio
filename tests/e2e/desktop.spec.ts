import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { promisify } from 'node:util'
import { _electron as electron, expect, test, type Locator, type Page } from '@playwright/test'

const execFileAsync = promisify(execFile)
const ollamaModel = 'tupiniquim-e2e-model'
const proposalTarget = 'proposta-gerada-pelo-ollama.txt'
const proposalContent = 'TUPINIQUIM_E2E_PROPOSAL_PRIVATE_CONTENT\n'

interface MockOllamaServer {
  url: string
  chatRequests: unknown[]
  close(): Promise<void>
}

const startMockOllama = async (): Promise<MockOllamaServer> => {
  const chatRequests: unknown[] = []
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/api/tags') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ models: [{ name: ollamaModel, model: ollamaModel, modified_at: '2026-08-20T12:00:00.000Z', size: 1_024 }] }))
      return
    }
    if (request.method === 'POST' && request.url === '/api/chat') {
      let body = ''
      request.setEncoding('utf8')
      request.on('data', (chunk: string) => { body += chunk })
      request.once('end', () => {
        try {
          chatRequests.push(JSON.parse(body))
          response.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' })
          response.end(`${JSON.stringify({
            message: {
              content: '',
              tool_calls: [{
                function: {
                  name: 'tupiniquim_workspace_write_proposal',
                  arguments: { relativePath: proposalTarget, content: proposalContent, operation: 'CREATE' }
                }
              }]
            },
            done: true
          })}\n`)
        } catch {
          response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          response.end(JSON.stringify({ error: 'invalid request' }))
        }
      })
      return
    }
    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ error: 'not found' }))
  })
  await new Promise<void>((resolve, reject) => {
    const onError = (cause: Error): void => reject(cause)
    server.once('error', onError)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError)
      resolve()
    })
  })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('O mock Ollama não recebeu uma porta TCP.')
  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    chatRequests,
    close: async () => {
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      })
    }
  }
}

test('inicia o Electron seguro e carrega um workspace real', async () => {
  const projectRoot = process.cwd()
  const mockOllama = await startMockOllama()
  let application: Awaited<ReturnType<typeof electron.launch>> | null = null
  const processErrors: string[] = []
  let workspaceRoot = ''

  try {
    application = await electron.launch({
      args: ['.'],
      cwd: projectRoot,
      timeout: 180_000,
      env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true', TUPINIQUIM_OLLAMA_BASE_URL: mockOllama.url }
    })
    application.process().stderr?.on('data', (chunk: Buffer) => processErrors.push(chunk.toString('utf8')))
    const temp = process.env.TEMP
    if (temp === undefined || path.parse(temp).root.toUpperCase() !== 'F:\\') throw new Error('TEMP de E2E precisa estar em F:.')
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
    await application.evaluate(({ dialog }, root) => {
      const approvalState = { count: 0 }
      Object.defineProperty(dialog, 'showOpenDialog', {
        configurable: true,
        value: () => Promise.resolve({ canceled: false, filePaths: [root] })
      })
      Object.defineProperty(dialog, 'showMessageBox', {
        configurable: true,
        value: () => {
          approvalState.count += 1
          return Promise.resolve({ response: 0, checkboxChecked: false })
        }
      })
      Object.defineProperty(dialog, '__tupiniquimE2EApprovalCount', {
        configurable: true,
        value: () => approvalState.count
      })
    }, workspaceRoot)
    await page.locator('.welcome-canvas').getByRole('button', { name: 'Abrir workspace' }).click()
    await expect(page.locator('.notice')).toContainText('Workspace autorizado')
    await expect(page.locator('.project-switcher')).toContainText(path.basename(workspaceRoot))

    await page.getByLabel('Provedor de IA').selectOption('ollama')
    await expect(page.getByText('Ollama usa somente o loopback local')).toBeVisible()
    await page.getByLabel('Modelo Ollama local').selectOption(ollamaModel)
    await expect(page.getByLabel('Modelo Ollama local')).toHaveValue(ollamaModel)
    await expect(page.locator('.availability')).toHaveText('READY')
    const providerStatus = await page.evaluate(async () => window.studio.agent.status())
    expect(providerStatus).toMatchObject({ ok: true, value: { provider: 'ollama', state: 'READY' } })

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
    const unapprovedTerminalPolicy = await page.evaluate(async () => {
      const created = await window.studio.terminal.create({ cwd: '', cols: 80, rows: 24 })
      if (!created.ok) return created
      const result = await window.studio.terminal.write({ terminalId: created.value.terminalId, data: 'Write-Output UNAPPROVED_TERMINAL_COMMAND\r' })
      await window.studio.terminal.kill({ terminalId: created.value.terminalId })
      return result
    })
    expect(unapprovedTerminalPolicy).toMatchObject({ ok: false, error: { code: 'APPROVAL_REQUIRED' } })

    const terminalPolicy = await page.evaluate(async () => {
      const created = await window.studio.terminal.create({ cwd: '', cols: 80, rows: 24 })
      if (!created.ok) return created
      const blocked = await window.studio.terminal.write({ terminalId: created.value.terminalId, data: 'git reset --hard HEAD\r' })
      await window.studio.terminal.kill({ terminalId: created.value.terminalId })
      return blocked
    })
    expect(terminalPolicy).toMatchObject({ ok: false, error: { code: 'POLICY_DENIED' } })

    expect(await page.evaluate(() => Object.prototype.hasOwnProperty.call(window.studio.planning, 'proposeWorkspaceWrite'))).toBe(false)
    await page.locator('.mode-switch').getByRole('button', { name: 'Plan', exact: true }).click()
    await page.getByLabel('Mensagem ao agente').fill('Crie um arquivo de evidência pelo fluxo aprovado do Ollama.')
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()

    const provenance = page.getByRole('region', { name: 'Proveniência da proposta de escrita' })
    const provenanceValue = (label: string) => provenance.locator('dt').filter({ hasText: new RegExp(`^${label}$`, 'u') }).locator('..').locator('dd')
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
    await expect(provenance).toBeVisible({ timeout: 30_000 })
    await expect(provenance.locator('header span')).toHaveText('PENDING_REVIEW')
    await expect(provenanceValue('Provider')).toHaveText('ollama')
    await expect(provenanceValue('Tool')).toHaveText('workspace.write')
    await expect(provenanceValue('Execution')).toHaveText(uuid)
    await expect(provenanceValue('Step')).toHaveText(uuid)
    await expect(provenanceValue('Thread')).toHaveText(uuid)
    await expect(provenanceValue('Turn')).toHaveText(uuid)
    await expect(provenanceValue('Tool call')).toHaveText(uuid)
    await expect(provenanceValue('Target')).toHaveText(proposalTarget)
    await expect(provenanceValue('Operation')).toHaveText('CREATE')
    await expect(provenanceValue('Manifest')).toHaveText(uuid)
    await expect(provenanceValue('Proposal')).toHaveText(uuid)
    await expect(provenanceValue('Hash')).toHaveText(createHash('sha256').update(proposalContent).digest('hex'))
    await expect(provenanceValue('Target baseline')).toHaveText('INEXISTENTE')
    await expect(provenanceValue('Timestamp')).not.toHaveText('')
    const proposalId = await provenanceValue('Proposal').textContent()
    const executionId = await provenanceValue('Execution').textContent()
    const proposalThreadId = await provenanceValue('Thread').textContent()
    if (proposalId === null) throw new Error('A proposta pública não expôs seu identificador.')
    if (executionId === null || proposalThreadId === null) throw new Error('A proposta pública não expôs a proveniência causal completa.')
    expect(await page.content()).not.toContain(proposalContent.trim())
    expect(mockOllama.chatRequests).toHaveLength(1)
    expect(mockOllama.chatRequests[0]).toMatchObject({
      model: ollamaModel,
      tools: [{ function: { name: 'tupiniquim_workspace_write_proposal' } }]
    })
    expect(JSON.stringify(mockOllama.chatRequests[0])).not.toMatch(/executionId|stepId/u)

    const startExecution = page.getByRole('button', { name: 'Iniciar execução', exact: true })
    await expect(startExecution).toBeDisabled()
    const applyBeforeApproval = await page.evaluate(async (id) => await window.studio.planning.applyProposedWorkspaceWrite({ proposalId: id }), proposalId)
    expect(applyBeforeApproval).toMatchObject({ ok: false })
    await page.getByRole('button', { name: 'Aprovar', exact: true }).click()
    await expect(provenance.locator('header span')).toHaveText('APPROVED')
    await expect(startExecution).toBeEnabled()
    await startExecution.click()
    await expect(provenance.locator('header span')).toHaveText('MATERIALIZED', { timeout: 30_000 })
    await expect(page.locator('.notice')).toContainText(`Proposta materializada atomicamente: ${proposalTarget}`)
    await expect(readFile(path.join(workspaceRoot, proposalTarget), 'utf8')).resolves.toBe(proposalContent)
    const replayAfterMaterialization = await page.evaluate(async (id) => await window.studio.planning.applyProposedWorkspaceWrite({ proposalId: id }), proposalId)
    expect(replayAfterMaterialization).toMatchObject({ ok: false })
    expect(await page.content()).not.toContain(proposalContent.trim())
    const persistedEvidence = await page.evaluate(async ({ executionId, threadId }) => {
      const [execution, events, history] = await Promise.all([
        window.studio.planning.read({ executionId }),
        window.studio.planning.events({ executionId }),
        window.studio.agent.history({ threadId })
      ])
      return { execution, events, history }
    }, { executionId, threadId: proposalThreadId })
    expect(JSON.stringify(persistedEvidence)).not.toContain(proposalContent.trim())
    const dataRoot = `${projectRoot}.data`
    const auditLog = await readFile(path.join(dataRoot, 'logs', 'audit.jsonl'), 'utf8')
    expect(auditLog).not.toContain(proposalContent.trim())
    const databaseFiles = (await readdir(path.join(dataRoot, 'database'))).filter((name) => name.startsWith('studio.sqlite'))
    const privateMarker = Buffer.from(proposalContent.trim(), 'utf8')
    for (const databaseFile of databaseFiles) {
      expect((await readFile(path.join(dataRoot, 'database', databaseFile))).includes(privateMarker)).toBe(false)
    }

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
    const privilegedApprovalCount = await application.evaluate(({ dialog }) => {
      const instrumented = dialog as typeof dialog & { __tupiniquimE2EApprovalCount: () => number }
      return instrumented.__tupiniquimE2EApprovalCount()
    })
    expect(privilegedApprovalCount).toBeGreaterThanOrEqual(2)

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
    try {
      if (application !== null) await application.close()
    } finally {
      try {
        if (workspaceRoot !== '') await rm(workspaceRoot, { recursive: true, force: true })
      } finally {
        await mockOllama.close()
      }
    }
  }
})

test('proposta substituída fica EXPIRED e aplicação da antiga é recusada', async () => {
  const projectRoot = process.cwd()
  const proposalTargetA = 'proposta-a-expirada.txt'
  const proposalContentA = 'E2E_PRIVATE_CONTENT_A'
  const proposalTargetB = 'proposta-b-atual.txt'
  const proposalContentB = 'E2E_PRIVATE_CONTENT_B'

  // Gate explícito e VISÍVEL: este cenário roda apenas no ambiente suportado
  // (Windows real com TEMP em F: e display Electron). Nunca fazer `return`
  // silencioso que produz PASS falso — fora do ambiente suportado o teste é
  // reportado como SKIPPED (não como passado) com a razão explícita abaixo.
  // A máquina Windows F: é o gate real (scripts/pnpm-f.ps1 validate + pnpm test:e2e).
  const tempEnv = process.env.TEMP
  test.skip(
    process.platform !== 'win32' || tempEnv === undefined || path.parse(tempEnv).root.toUpperCase() !== 'F:\\',
    `E2E de expiração requer Windows real com TEMP em F: e display Electron (plataforma=${process.platform}, TEMP=${tempEnv ?? 'ausente'}). Executar na máquina Windows F: via pnpm test:e2e.`
  )
  // Após o gate, TEMP está garantido em F: (Windows real).
  const temp = tempEnv as string

  let requestCount = 0
  const chatRequests: unknown[] = []
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/api/tags') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ models: [{ name: ollamaModel, model: ollamaModel, modified_at: '2026-08-20T12:00:00.000Z', size: 1_024 }] }))
      return
    }
    if (request.method === 'POST' && request.url === '/api/chat') {
      let body = ''
      request.setEncoding('utf8')
      request.on('data', (chunk: string) => { body += chunk })
      request.once('end', () => {
        try {
          chatRequests.push(JSON.parse(body))
          requestCount += 1
          const target = requestCount <= 1 ? proposalTargetA : proposalTargetB
          const content = requestCount <= 1 ? proposalContentA : proposalContentB
          response.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' })
          response.end(`${JSON.stringify({
            message: {
              content: '',
              tool_calls: [{
                function: {
                  name: 'tupiniquim_workspace_write_proposal',
                  arguments: { relativePath: target, content: `${content}\n`, operation: 'CREATE' }
                }
              }]
            },
            done: true
          })}\n`)
        } catch {
          response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          response.end(JSON.stringify({ error: 'invalid request' }))
        }
      })
      return
    }
    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ error: 'not found' }))
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve() })
  })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('Mock não recebeu porta.')
  const mockUrl = `http://127.0.0.1:${String(address.port)}`
  let application: Awaited<ReturnType<typeof electron.launch>> | null = null
  let workspaceRoot = ''
  let workspaceRootB = ''
  const provenanceRegion = (page: Page): Locator => page.getByRole('region', { name: 'Proveniência da proposta de escrita' })
  const proposalIdOf = (region: Locator): Locator => region.locator('dt').filter({ hasText: /^Proposal$/u }).locator('..').locator('dd')
  try {
    application = await electron.launch({
      args: ['.'],
      cwd: projectRoot,
      timeout: 180_000,
      env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true', TUPINIQUIM_OLLAMA_BASE_URL: mockUrl }
    })
    const processErrors: string[] = []
    application.process().stderr?.on('data', (chunk: Buffer) => processErrors.push(chunk.toString('utf8')))
    workspaceRoot = await mkdtemp(path.join(temp, 'tupiniquim-e2e-expire-'))
    await writeFile(path.join(workspaceRoot, 'README.md'), '# E2E Expiration\n', 'utf8')
    await execFileAsync('git', ['init', '--quiet'], { cwd: workspaceRoot })
    workspaceRootB = await mkdtemp(path.join(temp, 'tupiniquim-e2e-isolation-'))
    await writeFile(path.join(workspaceRootB, 'README.md'), '# E2E Isolation B\n', 'utf8')
    await execFileAsync('git', ['init', '--quiet'], { cwd: workspaceRootB })
    const page = await application.firstWindow({ timeout: 180_000 }).catch((cause: unknown) => {
      const detail = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`${detail}\nElectron stderr:\n${processErrors.join('')}`)
    })
    await expect(page).toHaveTitle('Tupiniquim AI Dev Studio')
    await application.evaluate(({ dialog }, roots) => {
      const queue = [roots.root, roots.nextRoot]
      let pickCount = 0
      Object.defineProperty(dialog, 'showOpenDialog', {
        configurable: true,
        value: () => Promise.resolve({ canceled: false, filePaths: [queue[pickCount++ % queue.length] ?? roots.root] })
      })
      Object.defineProperty(dialog, 'showMessageBox', {
        configurable: true,
        value: () => Promise.resolve({ response: 0, checkboxChecked: false })
      })
    }, { root: workspaceRoot, nextRoot: workspaceRootB })
    await page.locator('.welcome-canvas').getByRole('button', { name: 'Abrir workspace' }).click()
    await expect(page.locator('.notice')).toContainText('Workspace autorizado')
    await page.getByLabel('Provedor de IA').selectOption('ollama')
    await page.getByLabel('Modelo Ollama local').selectOption(ollamaModel)
    await expect(page.locator('.availability')).toHaveText('READY')

    // ── UM único plano: A/B compartilham EXATAMENTE executionId + stepId ────
    // O renderer cria um plano a cada envio em modo PLAN; para provar
    // substituição no slot executionId:stepId é necessário usar o mesmo slot
    // nas duas chamadas.
    const replacementSlot = await page.evaluate(async () => {
      const created = await window.studio.planning.create({ objective: 'E2E proposal replacement', mode: 'PLAN' })
      if (!created.ok) throw new Error(`planning.create falhou: ${created.error.message}`)
      const stepId = created.value.plan.steps.find((step) => step.requiresApproval)?.id
      if (stepId === undefined) throw new Error('Plano E2E sem passo de escrita aprovável.')
      return { executionId: created.value.execution.id, stepId }
    })
    const sendReplacementProposal = async (message: 'Proposta A.' | 'Proposta B.'): Promise<void> => {
      const sent = await page.evaluate(async (input) => await window.studio.agent.send({
        message: input.message,
        mode: 'PLAN',
        proposalContext: { executionId: input.executionId, stepId: input.stepId }
      }), { message, ...replacementSlot })
      if (!sent.ok) throw new Error(`agent.send falhou para ${message}: ${sent.error.message}`)
    }

    // ── Proposal A (PENDING_REVIEW) no slot compartilhado ───────────────────
    await sendReplacementProposal('Proposta A.')
    await expect(provenanceRegion(page)).toBeVisible({ timeout: 30_000 })
    const proposalIdA = await proposalIdOf(provenanceRegion(page).last()).textContent()
    if (proposalIdA === null) throw new Error('Proposal A sem ID.')

    // ── Proposal B no MESMO executionId + stepId substitui A ───────────────
    await sendReplacementProposal('Proposta B.')

    // Espera até existirem DOIS cards de proveniência (tombstone de A + B).
    await expect(provenanceRegion(page)).toHaveCount(2, { timeout: 30_000 })

    // Localiza EXPLICITAMENTE o card cujo Proposal == proposalIdA.
    const tombstoneA = provenanceRegion(page).filter({ has: page.locator('dd', { hasText: proposalIdA }) })
    await expect(tombstoneA).toHaveCount(1)
    await expect(tombstoneA.locator('header span')).toHaveText('EXPIRED')

    // Localiza B separadamente: o card que NÃO contém o id de A é o corrente.
    const cardB = provenanceRegion(page).filter({ hasNot: page.locator('dd', { hasText: proposalIdA }) })
    await expect(cardB).toHaveCount(1)
    await expect(cardB.locator('header span')).toHaveText('PENDING_REVIEW')
    const proposalIdB = await proposalIdOf(cardB).textContent()
    if (proposalIdB === null) throw new Error('Proposal B sem ID.')
    expect(proposalIdB).not.toBe(proposalIdA)

    // ── IPC: lookupProposalStatus(A) => EXPIRED; (B) => PENDING_REVIEW ──────
    const statusA = await page.evaluate(async (id: string) => await window.studio.agent.lookupProposalStatus(id), proposalIdA)
    expect(statusA).toMatchObject({ ok: true, value: 'EXPIRED' })
    const statusB = await page.evaluate(async (id: string) => await window.studio.agent.lookupProposalStatus(id), proposalIdB)
    expect(statusB).toMatchObject({ ok: true, value: 'PENDING_REVIEW' })
    // Segunda consulta de A continua EXPIRED.
    const statusAAgain = await page.evaluate(async (id: string) => await window.studio.agent.lookupProposalStatus(id), proposalIdA)
    expect(statusAAgain).toMatchObject({ ok: true, value: 'EXPIRED' })

    // ── applyProposedWorkspaceWrite(A) => erro ─────────────────────────────
    const applyA = await page.evaluate(async (id) => await window.studio.planning.applyProposedWorkspaceWrite({ proposalId: id }), proposalIdA)
    expect(applyA).toMatchObject({ ok: false })

    // ── Arquivo de A nunca é escrito ───────────────────────────────────────
    await expect(readFile(path.join(workspaceRoot, proposalTargetA), 'utf8')).rejects.toThrow()

    // ── Marcadores privados A/B ausentes de TODOS os artefatos públicos ─────
    const markers = [proposalContentA, proposalContentB]
    // 1) DOM.
    const dom = await page.content()
    for (const marker of markers) expect(dom).not.toContain(marker)
    // 2) Conversation pública dorenderer.
    const conversation = await page.locator('.agent-conversation').innerText()
    for (const marker of markers) expect(conversation).not.toContain(marker)
    // 3) History REAL: extrai os Thread IDs das cards de proveniência A/B e
    // consulta cada thread real, sem pseudo-check com threadId vazio.
    const provenanceRecords = await page.evaluate((): Array<Record<string, string>> => {
      const records: Array<Record<string, string>> = []
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.proposal-provenance dl'))
      for (const dl of nodes) {
        const fields: Record<string, string> = {}
        for (const dt of Array.from(dl.querySelectorAll<HTMLElement>('dt'))) {
          const label = dt.textContent?.trim() ?? ''
          const value = dt.parentElement?.querySelector('dd')?.textContent?.trim() ?? ''
          if (label !== '' && value !== '') fields[label] = value
        }
        records.push(fields)
      }
      return records
    })
    const recordA = provenanceRecords.find((record) => record.Proposal === proposalIdA)
    const recordB = provenanceRecords.find((record) => record.Proposal === proposalIdB)
    if (recordA === undefined || recordB === undefined) throw new Error('Cards de proveniência A/B não localizados.')
    // Prova explícita de que A e B usaram o MESMO slot executionId:stepId e a
    // MESMA thread vinculada, com turns/tool calls distintos (continuação).
    expect(recordB.Execution).toBe(recordA.Execution)
    expect(recordB.Step).toBe(recordA.Step)
    expect(recordB.Thread).toBe(recordA.Thread)
    expect(recordB.Turn).not.toBe(recordA.Turn)
    expect(recordB['Tool call']).not.toBe(recordA['Tool call'])
    expect(recordA.Target).toBe(proposalTargetA)
    expect(recordB.Target).toBe(proposalTargetB)
    const realThreadIds = [...new Set(provenanceRecords.map((record) => record.Thread).filter((value): value is string => value !== undefined && value !== ''))]
    expect(realThreadIds).toHaveLength(1)
    expect(realThreadIds[0]).toBe(recordA.Thread)
    const realHistory = await page.evaluate(async (threadIds) => {
      const thread: unknown[] = []
      const turns: unknown[][] = []
      const events: unknown[][] = []
      const raw: unknown[] = []
      for (const threadId of threadIds) {
        const history = await window.studio.agent.history({ threadId })
        raw.push(history)
        if (!history.ok) throw new Error(`agent.history falhou para threadId ${threadId}: ${history.error.message}`)
        thread.push(history.value.thread)
        turns.push(history.value.turns)
        events.push(history.value.events)
      }
      return { thread, turns, events, raw }
    }, realThreadIds)
    for (const marker of markers) {
      expect(JSON.stringify(realHistory.thread)).not.toContain(marker)
      expect(JSON.stringify(realHistory.turns)).not.toContain(marker)
      expect(JSON.stringify(realHistory.events)).not.toContain(marker)
      expect(JSON.stringify(realHistory.raw)).not.toContain(marker)
    }
    // 4) Flight Recorder events de TODAS as execuções, obtidos a partir dos
    // ids expostos nas cards de proveniência.
    const executionIds = await page.evaluate((): string[] => {
      const ids: string[] = []
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.proposal-provenance dl'))
      for (const dl of nodes) {
        const dts = Array.from(dl.querySelectorAll<HTMLElement>('dt'))
        const executionDt = dts.find((dt) => dt.textContent?.trim() === 'Execution')
        const dd = executionDt?.parentElement?.querySelector('dd')?.textContent
        if (dd !== null && dd !== undefined && dd !== '') ids.push(dd)
      }
      return ids
    })
    const flightRecorder = await page.evaluate(async (ids) => {
      const collected: unknown[] = []
      for (const executionId of ids) {
        const events = await window.studio.planning.events({ executionId })
        collected.push(events)
      }
      return JSON.stringify(collected)
    }, executionIds)
    for (const marker of markers) expect(flightRecorder).not.toContain(marker)

    // 5) AuditLog.
    const dataRoot = `${projectRoot}.data`
    const auditLog = await readFile(path.join(dataRoot, 'logs', 'audit.jsonl'), 'utf8')
    for (const marker of markers) expect(auditLog).not.toContain(marker)

    // 6) SQLite (arquivos studio.sqlite*).
    const databaseFiles = (await readdir(path.join(dataRoot, 'database'))).filter((name) => name.startsWith('studio.sqlite'))
    for (const marker of markers) {
      const needle = Buffer.from(marker, 'utf8')
      for (const databaseFile of databaseFiles) {
        expect((await readFile(path.join(dataRoot, 'database', databaseFile))).includes(needle)).toBe(false)
      }
    }

    // ── 7) Isolamento: tombstone A não sobrevive à troca para workspace B ─────
    const tombstoneAFields = provenanceRecords.find((record) => record.Proposal === proposalIdA)
    if (tombstoneAFields === undefined) throw new Error('O card EXPIRED de A não foi localizado para o teste de isolamento.')
    expect(tombstoneAFields.Target).toBe(proposalTargetA)
    const workspaceBName = path.basename(workspaceRootB)
    await page.locator('.project-switcher').click()
    await expect(page.locator('.project-switcher')).toContainText(workspaceBName)
    await expect(page.locator('.notice')).toContainText('Workspace autorizado')
    await expect(provenanceRegion(page)).toHaveCount(0)
    const isolationProvenance = await page.evaluate(() => {
      const regions = Array.from(document.querySelectorAll<HTMLElement>('.proposal-provenance'))
      return regions.map((node) => node.textContent ?? '').join('\n')
    })
    expect(isolationProvenance).not.toContain(tombstoneAFields.Proposal)
    expect(isolationProvenance).not.toContain(tombstoneAFields.Thread)
    expect(isolationProvenance).not.toContain(tombstoneAFields.Turn)
    expect(isolationProvenance).not.toContain(tombstoneAFields.Target)
    expect(isolationProvenance).not.toContain(tombstoneAFields.Hash)

    await page.screenshot({ path: path.join(projectRoot, 'test-results', 'expiration-flow.png'), fullPage: true })
  } finally {
    try {
      if (application !== null) await application.close()
    } finally {
      try {
        if (workspaceRoot !== '') await rm(workspaceRoot, { recursive: true, force: true })
        if (workspaceRootB !== '') await rm(workspaceRootB, { recursive: true, force: true })
      } finally {
        await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections() })
      }
    }
  }
})
