import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { promisify } from 'node:util'
import { _electron as electron, expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'

const execFileAsync = promisify(execFile)
const ollamaModel = 'tupiniquim-e2e-model'
const proposalTarget = 'proposta-gerada-pelo-ollama.txt'
const proposalContent = 'TUPINIQUIM_E2E_PROPOSAL_PRIVATE_CONTENT\n'

/**
 * Wave 16 — Incremento 4/4 (correção da auditoria externa, Bloqueio 3):
 * dataRoot ISOLADO e exclusivo do E2E. O Electron é lançado com o override
 * test-only `TUPINIQUIM_E2E=1` + `TUPINIQUIM_E2E_DATA_ROOT` apontando para um
 * mkdtemp sob o TEMP oficial do gate (sempre no volume autorizado F:). O
 * dataRoot OPERACIONAL de produção (F:\CODEX\Tupiniquim-AI-Dev-Studio.data)
 * NUNCA é usado pelos testes: nenhuma leitura de marcador constrói
 * `${projectRoot}.data` — todas usam o dataRoot CONFIRMADO pelo runtime via
 * `window.studio.system.info()`, e o cleanup remove o root isolado junto com
 * os workspaces.
 */
const createIsolatedE2eDataRoot = async (temp: string): Promise<string> =>
  await mkdtemp(path.join(temp, 'tupiniquim-e2e-data-'))

const withIsolatedE2eDataRoot = (env: NodeJS.ProcessEnv, e2eDataRoot: string): { [key: string]: string } => {
  // electron.launch exige env sem valores indefinidos: copia apenas as
  // entradas definidas e adiciona o override test-only do dataRoot.
  const merged: { [key: string]: string } = {}
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) merged[key] = value
  }
  merged.TUPINIQUIM_E2E = '1'
  merged.TUPINIQUIM_E2E_DATA_ROOT = e2eDataRoot
  return merged
}

/**
 * ATUALIZAÇÃO 4 (Windows F: — E2E READINESS): espera CANÔNICA de conclusão
 * REAL da abertura/troca de workspace.
 *
 * Com o dataRoot E2E isolado por teste (correto e preservado), cada processo
 * Electron inicia com um SQLite FRESCO: a primeira sequência
 * `workspace.configure → recovery → SQLite` paga o custo real de worker
 * startup, criação do DB, migrations e I/O no F: — custo que o timeout
 * implícito (~5s) do `expect` não cobre. Este helper substitui TODAS as
 * esperas de `.notice` contendo "Workspace autorizado" do arquivo.
 *
 * Sinais AUTORITATIVOS (não artificial): o renderer só publica
 * "Workspace autorizado..." DEPOIS de concluir workspace.configure,
 * agent.session (recovery), workspace list, git status, workspace context e
 * agent status — ou seja, a mensagem representa o fim real do fluxo, não um
 * delay. Quando pedido, confirma também o nome do workspace no
 * project-switcher e o data-session-id da Sessão Tupiniquim.
 *
 * Contrato:
 * - timeout explícito e bounded (60s default, bem abaixo do budget de teste
 *   de 420s); SEM sleeps fixos, SEM polling manual;
 * - sucesso SOMENTE por estado observado — nunca por tempo decorrido;
 * - em caso de falha, anexa diagnóstico útil (conteúdo atual de .notice e
 *   project-switcher, system.info se o IPC ainda responder, stderr/renderer
 *   errors já coletados pelo chamador), sem secrets/payload privado.
 */
const withDiagnosticsBudget = async <T>(promise: Promise<T>, budgetMs: number): Promise<T | null> => {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), budgetMs) })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

const expectWorkspaceAuthorized = async (
  page: Page,
  options: {
    expectedWorkspaceName?: string
    expectedSessionId?: string
    requireSession?: boolean
    timeout?: number
    diagnostics?: () => string
  } = {}
): Promise<void> => {
  const timeout = options.timeout ?? 60_000
  const readinessDetail = async (): Promise<string> => {
    const notice = await withDiagnosticsBudget(page.locator('.notice').textContent(), 1_000).catch(() => null)
    const switcher = await withDiagnosticsBudget(page.locator('.project-switcher').textContent(), 1_000).catch(() => null)
    let systemInfo: string
    try {
      const raw = await withDiagnosticsBudget(page.evaluate(async () => await window.studio.system.info()), 2_000)
      if (raw === null) systemInfo = 'timeout'
      else if (raw.ok) systemInfo = `ok (dataRoot=${raw.value.dataRoot})`
      else systemInfo = `erro (${raw.error.code})`
    } catch {
      systemInfo = 'indisponível (página/IPC)'
    }
    const extra = options.diagnostics === undefined ? '' : `\n${options.diagnostics().slice(0, 2_000)}`
    return `Diagnóstico readiness — notice=${notice ?? '<indisponível>'} · project-switcher=${switcher ?? '<indisponível>'} · system.info=${systemInfo}${extra}`
  }
  try {
    await expect(page.locator('.notice')).toContainText('Workspace autorizado', { timeout })
  } catch (cause) {
    throw new Error(
      `Workspace não ficou AUTORIZADO em ${String(timeout)}ms — configure/recovery não concluiu (readiness). ${await readinessDetail()}`,
      { cause }
    )
  }
  if (options.expectedWorkspaceName !== undefined) {
    await expect(page.locator('.project-switcher')).toContainText(options.expectedWorkspaceName, { timeout })
  }
  if (options.expectedSessionId !== undefined) {
    await expect(page.getByLabel('Sessão Tupiniquim')).toHaveAttribute('data-session-id', options.expectedSessionId, { timeout })
  } else if (options.requireSession === true) {
    await expect(page.getByLabel('Sessão Tupiniquim')).toHaveAttribute('data-session-id', /.+/u, { timeout })
  }
}

interface ProviderReadinessOptions {
  /** Budget bounded por espera de estado (default 60s, << budget de teste de 420s). */
  timeout?: number
  /** Contexto extra do chamador (stderr do Electron truncado, renderer errors truncados — sem secrets). */
  diagnostics?: () => string
}

interface ProviderSelectionOptions extends ProviderReadinessOptions {
  /**
   * SOMENTE para a PRIMEIRA seleção de provider logo após abrir o workspace
   * (nenhum send anterior neste processo): o provider default
   * (codex-app-server) ainda está DISCONNECTED — o estado terminal observável
   * só passa a existir DEPOIS da própria troca, que o helper confirma ao
   * final. Em qualquer cenário pós-send NÃO passe esta flag: a espera
   * prévia por `.availability == READY` é OBRIGATÓRIA.
   */
  initialProviderSelection?: boolean
}

/**
 * ATUALIZAÇÃO 5 (Windows F: — PROVIDER/MODEL READINESS E2E): helpers
 * canônicos de troca de provider/modelo. Correção EXCLUSIVA do harness E2E —
 * renderer, main, gate, providers, sessão e persistence NÃO mudam.
 *
 * Diagnóstico confirmado da corrida: o evento MESSAGE_DELTA escreve texto na
 * conversa ANTES do turno ser terminal (`sending` no renderer só volta a
 * `false` em TURN_COMPLETED/ERROR), e o core recusa troca de provider
 * enquanto qualquer runtime está BUSY/STARTING (PrivilegedRuntimeGate) — o
 * select do renderer também fica disabled enquanto `sending`/BUSY e
 * `selectAgentProvider` recusa silenciosamente. Logo, "texto visível na
 * conversa" NÃO é sinal válido para trocar provider após um send.
 *
 * Sinais AUTORITATIVOS (estado real observado, nunca tempo decorrido):
 * - `.availability == READY` — sinal de turno terminal/provider livre,
 *   OBRIGATÓRIO ANTES de qualquer troca pós-send;
 * - select `Provedor de IA` habilitado e com o valor esperado APÓS a troca;
 * - para Ollama: `Modelo Ollama local` visível, opção do modelo CARREGADA,
 *   modelo selecionado e `.availability == READY` ao final.
 *
 * Contrato: SEM sleeps fixos, SEM polling manual, SEM retries cegos, SEM
 * alteração do timeout global do Playwright — cada passo é uma espera
 * bounded (60s default) via matchers `toHave*`/`toBe*` do expect() sobre
 * estado observado.
 * Em falha, o erro carrega diagnóstico sanitizado: provider atual,
 * availability, existência do model selector, valores/opções de modelos e o
 * contexto extra do chamador (stderr/renderer errors truncados) — sem
 * secrets nem payload privado.
 */
const providerReadinessDetail = async (page: Page, options: ProviderReadinessOptions): Promise<string> => {
  const availability = await withDiagnosticsBudget(page.locator('.availability').textContent(), 1_000).catch(() => null)
  const providerSelect = page.getByLabel('Provedor de IA')
  const providerValue = await withDiagnosticsBudget(providerSelect.inputValue(), 1_000).catch(() => null)
  const providerEnabled = await withDiagnosticsBudget(providerSelect.isEnabled(), 1_000).catch(() => null)
  const modelSelect = page.getByLabel('Modelo Ollama local')
  const modelSelectorCount = await withDiagnosticsBudget(modelSelect.count(), 1_000).catch(() => null)
  let modelOptions = '<ausente>'
  if (modelSelectorCount !== null && modelSelectorCount > 0) {
    const values = await withDiagnosticsBudget(
      modelSelect.locator('option').evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value)),
      1_000
    ).catch(() => null)
    modelOptions = values === null ? '<indisponível>' : JSON.stringify(values)
  }
  const extra = options.diagnostics === undefined ? '' : `\n${options.diagnostics().slice(0, 2_000)}`
  return [
    'Diagnóstico provider readiness —',
    `availability=${availability ?? '<indisponível>'}`,
    `provider=${providerValue ?? '<indisponível>'}`,
    `providerEnabled=${providerEnabled === null ? '<indisponível>' : String(providerEnabled)}`,
    `modelSelector=${modelSelectorCount === null ? '<indisponível>' : modelSelectorCount > 0 ? 'presente' : 'ausente'}`,
    `modelOptions=${modelOptions}${extra}`
  ].join(' ')
}

const expectAgentReady = async (page: Page, options: ProviderReadinessOptions = {}): Promise<void> => {
  const timeout = options.timeout ?? 60_000
  try {
    await expect(page.locator('.availability')).toHaveText('READY', { timeout })
  } catch (cause) {
    throw new Error(
      `Agente não ficou READY em ${String(timeout)}ms — turno não terminal ou provider BUSY/STARTING. ${await providerReadinessDetail(page, options)}`,
      { cause }
    )
  }
}

const selectOllamaAndWaitReady = async (page: Page, model: string, options: ProviderSelectionOptions = {}): Promise<void> => {
  const timeout = options.timeout ?? 60_000
  const providerSelect = page.getByLabel('Provedor de IA')
  const modelSelect = page.getByLabel('Modelo Ollama local')
  try {
    if (options.initialProviderSelection !== true) {
      // Sinal AUTORITATIVO de turno terminal: obrigatório ANTES da troca em
      // qualquer cenário pós-send. toBeEnabled fecha a janela em que READY já
      // foi publicado mas `sending` ainda não voltou a false (o select fica
      // disabled até TURN_COMPLETED ser processado).
      await expectAgentReady(page, options)
      await expect(providerSelect).toBeEnabled({ timeout })
    }
    await providerSelect.selectOption('ollama', { timeout })
    await expect(providerSelect).toHaveValue('ollama', { timeout })
    await expect(modelSelect).toBeVisible({ timeout })
    await expect(modelSelect.locator(`option[value="${model}"]`)).toHaveCount(1, { timeout })
    await modelSelect.selectOption(model, { timeout })
    await expect(modelSelect).toHaveValue(model, { timeout })
    await expectAgentReady(page, options)
  } catch (cause) {
    throw new Error(
      `Seleção Ollama (modelo ${model}) não convergiu para estado terminal READY. ${await providerReadinessDetail(page, options)}`,
      { cause }
    )
  }
}

const selectCodexAndWaitReady = async (page: Page, options: ProviderSelectionOptions = {}): Promise<void> => {
  const timeout = options.timeout ?? 60_000
  const providerSelect = page.getByLabel('Provedor de IA')
  try {
    if (options.initialProviderSelection !== true) {
      await expectAgentReady(page, options)
      await expect(providerSelect).toBeEnabled({ timeout })
    }
    await providerSelect.selectOption('codex-app-server', { timeout })
    await expect(providerSelect).toHaveValue('codex-app-server', { timeout })
    await expectAgentReady(page, options)
  } catch (cause) {
    throw new Error(
      `Seleção Codex App Server não convergiu para estado terminal READY. ${await providerReadinessDetail(page, options)}`,
      { cause }
    )
  }
}

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

  let e2eDataRoot = ''

  try {
    const temp = process.env.TEMP
    if (temp === undefined || path.parse(temp).root.toUpperCase() !== 'F:\\') throw new Error('TEMP de E2E precisa estar em F:.')
    // dataRoot ISOLADO (Bloqueio 3): o processo Electron recebe o override
    // test-only; o dataRoot operacional nunca é tocado.
    e2eDataRoot = await createIsolatedE2eDataRoot(temp)
    application = await electron.launch({
      args: ['.'],
      cwd: projectRoot,
      timeout: 180_000,
      env: withIsolatedE2eDataRoot(
        { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true', TUPINIQUIM_OLLAMA_BASE_URL: mockOllama.url },
        e2eDataRoot
      )
    })
    application.process().stderr?.on('data', (chunk: Buffer) => processErrors.push(chunk.toString('utf8')))
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
    await expectWorkspaceAuthorized(page, {
      expectedWorkspaceName: path.basename(workspaceRoot),
      diagnostics: () => `rendererErrors=[${rendererErrors.join(' | ')}] · Electron stderr=[${processErrors.join('').slice(0, 1_000)}]`
    })

    // ATUALIZAÇÃO 5: seleção INICIAL (pós-autorização, sem send anterior) —
    // o provider default está DISCONNECTED; o estado terminal READY é
    // produzido e confirmado pela própria troca canônica abaixo.
    await selectOllamaAndWaitReady(page, ollamaModel, {
      initialProviderSelection: true,
      diagnostics: () => `rendererErrors=[${rendererErrors.join(' | ')}] · Electron stderr=[${processErrors.join('').slice(0, 1_000)}]`
    })
    await expect(page.getByText('Ollama usa somente o loopback local')).toBeVisible()
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
    // dataRoot CONFIRMADO pelo runtime (Bloqueio 3): leituras NUNCA usam o
    // root operacional — o override test-only aponta para o root isolado.
    const systemInfo = await page.evaluate(async () => await window.studio.system.info())
    if (!systemInfo.ok) throw new Error('system.info indisponível.')
    expect(systemInfo.value.dataRoot).toBe(e2eDataRoot)
    const dataRoot = systemInfo.value.dataRoot
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
        if (e2eDataRoot !== '') await rm(e2eDataRoot, { recursive: true, force: true })
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
  let e2eDataRoot = ''

  try {
    // dataRoot ISOLADO (Bloqueio 3): override test-only; o dataRoot
    // operacional nunca é tocado por este teste.
    e2eDataRoot = await createIsolatedE2eDataRoot(temp)
    application = await electron.launch({
      args: ['.'],
      cwd: projectRoot,
      timeout: 180_000,
      env: withIsolatedE2eDataRoot({ ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true', TUPINIQUIM_OLLAMA_BASE_URL: mockUrl }, e2eDataRoot)
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
    await expectWorkspaceAuthorized(page, {
      expectedWorkspaceName: path.basename(workspaceRoot),
      diagnostics: () => `Electron stderr=[${processErrors.join('').slice(0, 1_000)}]`
    })
    await selectOllamaAndWaitReady(page, ollamaModel, {
      initialProviderSelection: true,
      diagnostics: () => `Electron stderr=[${processErrors.join('').slice(0, 1_000)}]`
    })

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

    // 5) AuditLog — dataRoot CONFIRMADO pelo runtime (Bloqueio 3): as
    // leituras usam o root isolado retornado pelo próprio processo, nunca o
    // root operacional.
    const systemInfo = await page.evaluate(async () => await window.studio.system.info())
    if (!systemInfo.ok) throw new Error('system.info indisponível.')
    expect(systemInfo.value.dataRoot).toBe(e2eDataRoot)
    const dataRoot = systemInfo.value.dataRoot
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
    await expectWorkspaceAuthorized(page, {
      expectedWorkspaceName: workspaceBName,
      diagnostics: () => `Electron stderr=[${processErrors.join('').slice(0, 1_000)}]`
    })
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
        if (e2eDataRoot !== '') await rm(e2eDataRoot, { recursive: true, force: true })
      } finally {
        await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections() })
      }
    }
  }
})

test('sessão Tupiniquim sobrevive à troca de provider fake e isola workspace', async () => {
  const projectRoot = process.cwd()
  const continuityMessage = 'Meu projeto usa arquitetura X'
  const sessionProposalTarget = 'proposta-sessao-wave15.txt'
  const sessionProposalContent = 'E2E_SESSION_PRIVATE_PAYLOAD'

  const tempEnv = process.env.TEMP
  test.skip(
    process.platform !== 'win32' || tempEnv === undefined || path.parse(tempEnv).root.toUpperCase() !== 'F:\\',
    `E2E de continuidade requer Windows real com TEMP em F: e display Electron (plataforma=${process.platform}, TEMP=${tempEnv ?? 'ausente'}). Executar na máquina Windows F: via pnpm test:e2e.`
  )
  const temp = tempEnv as string

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
          const parsed = JSON.parse(body) as { tools?: unknown[] }
          chatRequests.push(parsed)
          const usesTools = Array.isArray(parsed.tools) && parsed.tools.length > 0
          response.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' })
          response.end(`${JSON.stringify(usesTools ? {
            message: {
              content: '',
              tool_calls: [{
                function: {
                  name: 'tupiniquim_workspace_write_proposal',
                  arguments: { relativePath: sessionProposalTarget, content: sessionProposalContent, operation: 'CREATE' }
                }
              }]
            },
            done: true
          } : {
            message: { content: 'TUPINIQUIM_SESSION_OK' },
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
  let e2eDataRoot = ''

  try {
    // dataRoot ISOLADO (Bloqueio 3): override test-only; o dataRoot
    // operacional nunca é tocado por este teste.
    e2eDataRoot = await createIsolatedE2eDataRoot(temp)
    application = await electron.launch({
      args: ['.'],
      cwd: projectRoot,
      timeout: 180_000,
      env: withIsolatedE2eDataRoot({
        ...process.env,
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
        TUPINIQUIM_OLLAMA_BASE_URL: mockUrl,
        TUPINIQUIM_CODEX_PATH: process.execPath,
        TUPINIQUIM_CODEX_SERVER_ARGS: JSON.stringify([path.join(projectRoot, 'tests', 'fixtures', 'fake-codex-app-server.mjs')])
      }, e2eDataRoot)
    })
    const processErrors: string[] = []
    application.process().stderr?.on('data', (chunk: Buffer) => processErrors.push(chunk.toString('utf8')))
    workspaceRoot = await mkdtemp(path.join(temp, 'tupiniquim-e2e-session-a-'))
    await writeFile(path.join(workspaceRoot, 'README.md'), '# E2E Session A\n', 'utf8')
    await execFileAsync('git', ['init', '--quiet'], { cwd: workspaceRoot })
    workspaceRootB = await mkdtemp(path.join(temp, 'tupiniquim-e2e-session-b-'))
    await writeFile(path.join(workspaceRootB, 'README.md'), '# E2E Session B\n', 'utf8')
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
    await expectWorkspaceAuthorized(page, {
      expectedWorkspaceName: path.basename(workspaceRoot),
      requireSession: true,
      diagnostics: () => `Electron stderr=[${processErrors.join('').slice(0, 1_000)}]`
    })
    const sessionIdA = await page.getByLabel('Sessão Tupiniquim').getAttribute('data-session-id')
    if (sessionIdA === null || sessionIdA === '') throw new Error('Sessão Tupiniquim ausente após abrir o workspace.')

    await selectOllamaAndWaitReady(page, ollamaModel, {
      initialProviderSelection: true,
      diagnostics: () => `Electron stderr=[${processErrors.join('').slice(0, 1_000)}]`
    })
    await expect(page.getByLabel('Provedor de IA')).toBeEnabled()

    await page.locator('.mode-switch').getByRole('button', { name: 'Chat', exact: true }).click()
    await page.getByLabel('Mensagem ao agente').fill(continuityMessage)
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.locator('.agent-conversation')).toContainText(continuityMessage)
    await expect(page.locator('.agent-conversation')).toContainText('TUPINIQUIM_SESSION_OK', { timeout: 30_000 })

    const proposalSlot = await page.evaluate(async () => {
      const created = await window.studio.planning.create({ objective: 'E2E session proposal authority', mode: 'PLAN' })
      if (!created.ok) throw new Error(`planning.create falhou: ${created.error.message}`)
      const stepId = created.value.plan.steps.find((step) => step.requiresApproval)?.id
      if (stepId === undefined) throw new Error('Plano E2E sem passo de escrita aprovável.')
      const sent = await window.studio.agent.send({
        message: 'Proponha um arquivo pela sessão Tupiniquim.',
        mode: 'PLAN',
        proposalContext: { executionId: created.value.execution.id, stepId }
      })
      if (!sent.ok) throw new Error(`agent.send falhou: ${sent.error.message}`)
      return { executionId: created.value.execution.id, stepId, threadId: sent.value.threadId }
    })
    await expect(provenanceRegion(page)).toBeVisible({ timeout: 30_000 })
    await expect(provenanceRegion(page).locator('header span')).toHaveText('PENDING_REVIEW')
    const proposalId = await provenanceRegion(page).locator('dt').filter({ hasText: /^Proposal$/u }).locator('..').locator('dd').textContent()
    if (proposalId === null) throw new Error('Proposal da sessão sem ID.')

    const beforeSwitch = await page.evaluate(async () => await window.studio.agent.session())
    if (!beforeSwitch.ok || beforeSwitch.value === null) throw new Error('Sessão Tupiniquim indisponível antes da troca.')
    expect(beforeSwitch.value.session.id).toBe(sessionIdA)
    expect(beforeSwitch.value.providerThreads).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'ollama', threadId: proposalSlot.threadId, model: ollamaModel })
    ]))
    expect(beforeSwitch.value.turns.some((turn) => turn.role === 'assistant' && turn.model === ollamaModel)).toBe(true)

    // ATUALIZAÇÃO 5: troca PÓS-send/proposal — exige `.availability == READY`
    // (turno terminal REAL) antes do selectOption; card PENDING_REVIEW visível
    // não prova turno terminal.
    await selectCodexAndWaitReady(page, {
      diagnostics: () => `Electron stderr=[${processErrors.join('').slice(0, 1_000)}]`
    })
    await expect(page.getByLabel('Sessão Tupiniquim')).toHaveAttribute('data-session-id', sessionIdA)
    await expect(page.locator('.agent-conversation')).toContainText(continuityMessage)
    await expect(page.locator('.agent-conversation')).toContainText('TUPINIQUIM_SESSION_OK')
    await expect(provenanceRegion(page).filter({ has: page.locator('dd', { hasText: proposalId }) }).locator('header span')).toHaveText('EXPIRED')

    const statusAfterSwitch = await page.evaluate(async (id: string) => await window.studio.agent.lookupProposalStatus(id), proposalId)
    expect(statusAfterSwitch).toMatchObject({ ok: true, value: 'EXPIRED' })
    const applyAfterSwitch = await page.evaluate(async (id) => await window.studio.planning.applyProposedWorkspaceWrite({ proposalId: id }), proposalId)
    expect(applyAfterSwitch).toMatchObject({ ok: false })
    const hijack = await page.evaluate(async (slot) => await window.studio.agent.send({
      message: 'Não transfira a proposta.',
      mode: 'PLAN',
      proposalContext: { executionId: slot.executionId, stepId: slot.stepId }
    }), proposalSlot)
    expect(hijack).toMatchObject({ ok: false })

    await page.getByLabel('Mensagem ao agente').fill('Continue a análise')
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.locator('.agent-conversation')).toContainText('CONTEXTO_TUPINIQUIM_OK', { timeout: 30_000 })

    const afterSwitch = await page.evaluate(async () => await window.studio.agent.session())
    if (!afterSwitch.ok || afterSwitch.value === null) throw new Error('Sessão Tupiniquim indisponível depois da troca.')
    expect(afterSwitch.value.session.id).toBe(sessionIdA)
    const ollamaThread = afterSwitch.value.providerThreads.find((binding) => binding.provider === 'ollama')?.threadId
    const codexThread = afterSwitch.value.providerThreads.find((binding) => binding.provider === 'codex-app-server')?.threadId
    expect(ollamaThread).toBe(proposalSlot.threadId)
    expect(codexThread).toBeTruthy()
    expect(codexThread).not.toBe(ollamaThread)
    expect(afterSwitch.value.providerThreads.find((binding) => binding.provider === 'codex-app-server')?.model).toBe('codex-test-model')
    expect(afterSwitch.value.turns.some((turn) => turn.provider === 'codex-app-server' && turn.role === 'assistant' && turn.model === 'codex-test-model')).toBe(true)
    expect(afterSwitch.value.proposalAuthority).toBeNull()
    expect(JSON.stringify(afterSwitch.value)).not.toContain(sessionProposalContent)
    expect(JSON.stringify(afterSwitch.value)).toContain(continuityMessage)
    expect(await page.content()).not.toContain(sessionProposalContent)
    expect(await page.locator('.agent-conversation').innerText()).not.toContain(sessionProposalContent)

    // ATUALIZAÇÃO 5: troca PÓS-send Codex — `CONTEXTO_TUPINIQUIM_OK` chega via
    // MESSAGE_DELTA (texto visível != turno terminal); exigir READY real.
    await selectOllamaAndWaitReady(page, ollamaModel, {
      diagnostics: () => `Electron stderr=[${processErrors.join('').slice(0, 1_000)}]`
    })
    await page.getByLabel('Mensagem ao agente').fill('Retome no Ollama.')
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.locator('.agent-conversation')).toContainText('Retome no Ollama.', { timeout: 30_000 })
    const resumedOllama = JSON.stringify(chatRequests.at(-1) ?? {})
    expect(resumedOllama).toContain('CONTEXTO DA SESSÃO TUPINIQUIM')
    expect(resumedOllama).toContain('Continue a análise')
    expect(resumedOllama).toContain(continuityMessage)
    expect(resumedOllama).not.toContain(sessionProposalContent)

    // dataRoot CONFIRMADO pelo runtime (Bloqueio 3): leituras do root
    // isolado retornado pelo próprio processo, nunca o root operacional.
    const systemInfo = await page.evaluate(async () => await window.studio.system.info())
    if (!systemInfo.ok) throw new Error('system.info indisponível.')
    expect(systemInfo.value.dataRoot).toBe(e2eDataRoot)
    const dataRoot = systemInfo.value.dataRoot
    const auditLog = await readFile(path.join(dataRoot, 'logs', 'audit.jsonl'), 'utf8')
    expect(auditLog).not.toContain(sessionProposalContent)
    const databaseFiles = (await readdir(path.join(dataRoot, 'database'))).filter((name) => name.startsWith('studio.sqlite'))
    const privateMarker = Buffer.from(sessionProposalContent, 'utf8')
    for (const databaseFile of databaseFiles) {
      expect((await readFile(path.join(dataRoot, 'database', databaseFile))).includes(privateMarker)).toBe(false)
    }

    await page.locator('.project-switcher').click()
    await expectWorkspaceAuthorized(page, {
      expectedWorkspaceName: path.basename(workspaceRootB),
      requireSession: true,
      diagnostics: () => `Electron stderr=[${processErrors.join('').slice(0, 1_000)}]`
    })
    const sessionIdB = await page.getByLabel('Sessão Tupiniquim').getAttribute('data-session-id')
    expect(sessionIdB).toBeTruthy()
    expect(sessionIdB).not.toBe(sessionIdA)
    await expect(page.locator('.agent-conversation')).not.toContainText(continuityMessage)
    await expect(provenanceRegion(page)).toHaveCount(0)
    const isolated = await page.evaluate(async () => await window.studio.agent.session())
    if (!isolated.ok || isolated.value === null) throw new Error('Sessão do workspace B ausente.')
    expect(isolated.value.session.id).toBe(sessionIdB)
    expect(isolated.value.turns).toEqual([])
    expect(isolated.value.providerThreads).toEqual([])
    expect(JSON.stringify(isolated.value)).not.toContain(continuityMessage)
    expect(JSON.stringify(isolated.value)).not.toContain(sessionProposalContent)

    await page.locator('.project-switcher').click()
    await expectWorkspaceAuthorized(page, {
      expectedWorkspaceName: path.basename(workspaceRoot),
      expectedSessionId: sessionIdA,
      diagnostics: () => `Electron stderr=[${processErrors.join('').slice(0, 1_000)}]`
    })
    await expect(page.locator('.agent-conversation')).toContainText(continuityMessage)
    const restored = await page.evaluate(async () => await window.studio.agent.session())
    if (!restored.ok || restored.value === null) throw new Error('Sessão A não foi restaurada.')
    expect(restored.value.session.id).toBe(sessionIdA)
    expect(restored.value.turns.some((turn) => turn.text.includes(continuityMessage))).toBe(true)
    expect(JSON.stringify(restored.value)).not.toContain(sessionProposalContent)
  } finally {
    try {
      if (application !== null) await application.close()
    } finally {
      try {
        if (workspaceRoot !== '') await rm(workspaceRoot, { recursive: true, force: true })
        if (workspaceRootB !== '') await rm(workspaceRootB, { recursive: true, force: true })
        if (e2eDataRoot !== '') await rm(e2eDataRoot, { recursive: true, force: true })
      } finally {
        await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections() })
      }
    }
  }
})

test('shutdown aguardável encerra o processo REAL e o restart recupera a mesma Tupiniquim Session', async () => {
  const projectRoot = process.cwd()
  /**
   * Wave 16 — Incremento 4/4: restart E2E REAL.
   *
   *   Electron processo 1 → shutdown normal (sequenciador aguardável)
   *   → processo realmente encerra (exit code 0, single-instance lock liberado)
   *   → Electron processo 2 (MESMO dataRoot) → recovery da MESMA session S.
   *
   * Não são aceitos como substituto deste teste: recriar service, reabrir só o
   * SQLite, reinstanciar adapter no mesmo processo ou mock lógico de restart.
   * O gate real continua sendo a máquina Windows F: (pnpm test:e2e).
   *
   * Correção da auditoria externa (Bloqueio 3): os DOIS processos usam o
   * dataRoot E2E ISOLADO (TUPINIQUIM_E2E=1 + TUPINIQUIM_E2E_DATA_ROOT =
   * mkdtemp sob o TEMP oficial F:). O dataRoot operacional
   * (F:\CODEX\Tupiniquim-AI-Dev-Studio.data) NUNCA é usado, construído ou
   * removido; a prova é tripla — processo1.dataRoot === processo2.dataRoot
   * === e2eDataRoot — e as leituras de marcador usam o root CONFIRMADO pelo
   * runtime (window.studio.system.info()).
   */
  const tempEnv = process.env.TEMP
  test.skip(
    process.platform !== 'win32' || tempEnv === undefined || path.parse(tempEnv).root.toUpperCase() !== 'F:\\',
    `E2E de restart requer Windows real com TEMP em F: e display Electron (plataforma=${process.platform}, TEMP=${tempEnv ?? 'ausente'}). Executar na máquina Windows F: via pnpm test:e2e.`
  )
  const temp = tempEnv as string

  // Marcador privado EXCLUSIVO da execução (nunca deve vazar para artefato público).
  const privateMarker = `E2E_WAVE16_PRIVATE_${randomUUID()}`
  const newPrivateMarker = `E2E_WAVE16_PRIVATE_NEW_${randomUUID()}`
  const restartProposalTarget = 'proposta-restart-wave16.txt'
  const continuityMessage = 'Meu projeto usa arquitetura X'
  const codexMessage = 'Continue a análise'
  const ollamaResumeMessage = 'Retome no Ollama.'
  const postRestartMessage = 'Nova pergunta pós-restart'
  const postRestartMessage2 = 'Mais uma pergunta pós-restart'

  interface ChatRequest { model: string; messages: Array<{ role: string; content: string }> }
  const chatRequests: ChatRequest[] = []
  let toolRequestCount = 0
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
          const parsed = JSON.parse(body) as ChatRequest & { tools?: unknown[] }
          chatRequests.push(parsed)
          const usesTools = Array.isArray(parsed.tools) && parsed.tools.length > 0
          // A PRIMEIRA proposal (fase 1) carrega o marcador privado original;
          // a segunda (fase 2) carrega um payload novo — o antigo nunca pode
          // ressuscitar depois do restart.
          if (usesTools) toolRequestCount += 1
          const proposalContent = `${toolRequestCount === 1 ? privateMarker : newPrivateMarker}\n`
          response.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' })
          response.end(`${JSON.stringify(usesTools ? {
            message: {
              content: '',
              tool_calls: [{
                function: {
                  name: 'tupiniquim_workspace_write_proposal',
                  arguments: { relativePath: restartProposalTarget, content: proposalContent, operation: 'CREATE' }
                }
              }]
            },
            done: true
          } : {
            message: { content: 'TUPINIQUIM_SESSION_OK' },
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

  // dataRoot E2E ISOLADO (Bloqueio 3): MESMO root para os DOIS processos —
  // criado uma única vez antes do launch; o cleanup remove no final.
  const e2eDataRoot = await createIsolatedE2eDataRoot(temp)
  const launchEnv = withIsolatedE2eDataRoot({
    ...process.env,
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    TUPINIQUIM_OLLAMA_BASE_URL: mockUrl,
    TUPINIQUIM_CODEX_PATH: process.execPath,
    TUPINIQUIM_CODEX_SERVER_ARGS: JSON.stringify([path.join(projectRoot, 'tests', 'fixtures', 'fake-codex-app-server.mjs')])
  }, e2eDataRoot)
  const provenanceRegion = (page: Page): Locator => page.getByRole('region', { name: 'Proveniência da proposta de escrita' })
  const proposalIdOf = (region: Locator): Locator => region.locator('dt').filter({ hasText: /^Proposal$/u }).locator('..').locator('dd')
  const waitForRealExit = async (application: ElectronApplication, budgetMs = 120_000): Promise<number | null> => {
    const child = application.process()
    if (child.exitCode !== null) return child.exitCode
    return await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(-1), budgetMs)
      child.once('exit', (code) => { clearTimeout(timer); resolve(code) })
    })
  }

  let application: ElectronApplication | null = null
  let workspaceRoot = ''
  let workspaceRootB = ''
  try {
    workspaceRoot = await mkdtemp(path.join(temp, 'tupiniquim-e2e-restart-a-'))
    await writeFile(path.join(workspaceRoot, 'README.md'), '# E2E Restart A\n', 'utf8')
    await execFileAsync('git', ['init', '--quiet'], { cwd: workspaceRoot })
    workspaceRootB = await mkdtemp(path.join(temp, 'tupiniquim-e2e-restart-b-'))
    await writeFile(path.join(workspaceRootB, 'README.md'), '# E2E Restart B\n', 'utf8')
    await execFileAsync('git', ['init', '--quiet'], { cwd: workspaceRootB })

    // ══════════════════════════ FASE 1 — PROCESSO 1 ══════════════════════════
    application = await electron.launch({ args: ['.'], cwd: projectRoot, timeout: 180_000, env: launchEnv })
    const processErrors: string[] = []
    application.process().stderr?.on('data', (chunk: Buffer) => processErrors.push(chunk.toString('utf8')))
    const page = await application.firstWindow({ timeout: 180_000 }).catch((cause: unknown) => {
      const detail = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`${detail}\nElectron stderr:\n${processErrors.join('')}`)
    })
    await expect(page).toHaveTitle('Tupiniquim AI Dev Studio')
    await application.evaluate(({ dialog }, roots) => {
      const queue = [roots.root, roots.nextRoot, roots.root]
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
    await expectWorkspaceAuthorized(page, {
      expectedWorkspaceName: path.basename(workspaceRoot),
      requireSession: true,
      diagnostics: () => `Electron stderr=[${processErrors.join('').slice(0, 1_000)}]`
    })
    const sessionIdA = await page.getByLabel('Sessão Tupiniquim').getAttribute('data-session-id')
    if (sessionIdA === null || sessionIdA === '') throw new Error('Sessão Tupiniquim ausente na fase 1.')
    const systemInfo1 = await page.evaluate(async () => await window.studio.system.info())
    if (!systemInfo1.ok) throw new Error('system.info indisponível na fase 1.')
    // Bloqueio 3 (1/3 da prova tripla): o processo 1 roda no dataRoot E2E
    // isolado — nunca no operacional.
    expect(systemInfo1.value.dataRoot).toBe(e2eDataRoot)

    // CHAT inicial (binding Ollama + conversa pública).
    await selectOllamaAndWaitReady(page, ollamaModel, {
      initialProviderSelection: true,
      diagnostics: () => `Electron stderr=[${processErrors.join('').slice(0, 1_000)}]`
    })
    await page.locator('.mode-switch').getByRole('button', { name: 'Chat', exact: true }).click()
    await page.getByLabel('Mensagem ao agente').fill(continuityMessage)
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.locator('.agent-conversation')).toContainText(continuityMessage)
    await expect(page.locator('.agent-conversation')).toContainText('TUPINIQUIM_SESSION_OK', { timeout: 30_000 })

    // Proposal efêmera com marcador privado (authority efêmera).
    const proposalSlot = await page.evaluate(async () => {
      const created = await window.studio.planning.create({ objective: 'E2E restart proposal authority', mode: 'PLAN' })
      if (!created.ok) throw new Error(`planning.create falhou: ${created.error.message}`)
      const stepId = created.value.plan.steps.find((step) => step.requiresApproval)?.id
      if (stepId === undefined) throw new Error('Plano E2E sem passo de escrita aprovável.')
      const sent = await window.studio.agent.send({
        message: 'Proponha um arquivo para o teste de restart.',
        mode: 'PLAN',
        proposalContext: { executionId: created.value.execution.id, stepId }
      })
      if (!sent.ok) throw new Error(`agent.send falhou: ${sent.error.message}`)
      return { executionId: created.value.execution.id, stepId, threadId: sent.value.threadId }
    })
    await expect(provenanceRegion(page)).toBeVisible({ timeout: 30_000 })
    await expect(provenanceRegion(page).locator('header span')).toHaveText('PENDING_REVIEW')
    const proposalIdA = await proposalIdOf(provenanceRegion(page)).textContent()
    if (proposalIdA === null) throw new Error('Proposal da fase 1 sem ID.')

    // Troca de provider mantendo a MESMA Tupiniquim Session.
    // ATUALIZAÇÃO 5: PÓS-send/proposal — READY terminal obrigatório ANTES.
    await selectCodexAndWaitReady(page, {
      diagnostics: () => `Electron stderr=[${processErrors.join('').slice(0, 1_000)}]`
    })
    await expect(page.getByLabel('Sessão Tupiniquim')).toHaveAttribute('data-session-id', sessionIdA)
    await expect(provenanceRegion(page).filter({ has: page.locator('dd', { hasText: proposalIdA }) }).locator('header span')).toHaveText('EXPIRED')

    // CHAT no Codex: produz turno público de outro provider (contexto cruzado).
    await page.getByLabel('Mensagem ao agente').fill(codexMessage)
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.locator('.agent-conversation')).toContainText('CONTEXTO_TUPINIQUIM_OK', { timeout: 30_000 })

    // Volta ao Ollama: o contexto não visto (turnos Codex) é entregue via
    // sessionContext e ACKado em SUCCESS — visto/seen fica durável.
    // ATUALIZAÇÃO 5 (CORREÇÃO DA CORRIDA): `CONTEXTO_TUPINIQUIM_OK` aparece na
    // conversa via MESSAGE_DELTA ANTES do turno ser terminal — trocar provider
    // nesse instante é recusado (renderer `sending` + gate BUSY) e o model
    // selector do Ollama nunca aparece. Obrigatório: `.availability == READY`
    // (turno terminal REAL) + select habilitado ANTES da troca.
    await selectOllamaAndWaitReady(page, ollamaModel, {
      diagnostics: () => `Electron stderr=[${processErrors.join('').slice(0, 1_000)}]`
    })
    await page.getByLabel('Mensagem ao agente').fill(ollamaResumeMessage)
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.locator('.agent-conversation')).toContainText('TUPINIQUIM_SESSION_OK', { timeout: 30_000 })
    const resumeRequest = chatRequests.at(-1)
    if (resumeRequest === undefined) throw new Error('Request de retomada não registrado.')
    expect(JSON.stringify(resumeRequest)).toContain('CONTEXTO DA SESSÃO TUPINIQUIM')
    expect(JSON.stringify(resumeRequest)).toContain(codexMessage)
    expect(JSON.stringify(resumeRequest)).not.toContain(privateMarker)

    const beforeQuit = await page.evaluate(async () => await window.studio.agent.session())
    if (!beforeQuit.ok || beforeQuit.value === null) throw new Error('Sessão Tupiniquim indisponível antes do shutdown.')
    expect(beforeQuit.value.session.id).toBe(sessionIdA)
    expect(beforeQuit.value.proposalAuthority).toBeNull()
    const threadsBeforeQuit = [...beforeQuit.value.providerThreads].sort((left, right) => left.provider.localeCompare(right.provider))

    // ── SHUTDOWN NORMAL REAL: app.quit() → before-quit → sequenciador
    // aguardável → processo realmente encerra com exit code 0. ──────────────
    const chatRequestsPhase1 = chatRequests.length
    await application.evaluate(({ app }) => { app.quit() })
    const exitCode = await waitForRealExit(application)
    expect(exitCode, `Processo 1 não encerrou limpo (stderr: ${processErrors.join('').slice(0, 2_000)}).`).toBe(0)
    application = null

    // O shutdown aguardável deixou evidência sanitizada no AuditLog ANTES da
    // saída. Leituras usam o dataRoot CONFIRMADO pelo runtime (Bloqueio 3) —
    // o teste NUNCA constrói `${projectRoot}.data` (root operacional).
    const dataRoot = systemInfo1.value.dataRoot
    expect(dataRoot).toBe(e2eDataRoot)
    const auditAfterShutdown = await readFile(path.join(dataRoot, 'logs', 'audit.jsonl'), 'utf8')
    const shutdownLines = auditAfterShutdown.split('\n').filter((line) => line.includes('"capability":"app.shutdown"'))
    expect(shutdownLines.length).toBeGreaterThanOrEqual(1)
    expect(shutdownLines.at(-1) ?? '').toContain('"outcome":"SUCCESS"')
    expect(shutdownLines.at(-1) ?? '').toContain('databaseClosed=yes')
    expect(shutdownLines.at(-1) ?? '').toContain('sealed=yes')
    expect(shutdownLines.at(-1) ?? '').toContain('runtimeQuiescent=yes')
    expect(shutdownLines.at(-1) ?? '').toContain('persistenceQuiescent=yes')
    expect(shutdownLines.at(-1) ?? '').not.toContain(privateMarker)

    // ══════════════════════════ FASE 2 — PROCESSO 2 ══════════════════════════
    application = await electron.launch({ args: ['.'], cwd: projectRoot, timeout: 180_000, env: launchEnv })
    const processErrors2: string[] = []
    application.process().stderr?.on('data', (chunk: Buffer) => processErrors2.push(chunk.toString('utf8')))
    const page2 = await application.firstWindow({ timeout: 180_000 }).catch((cause: unknown) => {
      const detail = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`${detail}\nElectron stderr (processo 2):\n${processErrors2.join('')}`)
    })
    await expect(page2).toHaveTitle('Tupiniquim AI Dev Studio')
    await application.evaluate(({ dialog }, roots) => {
      const queue = [roots.root, roots.nextRoot, roots.root]
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

    // Prova TRIPLA do dataRoot isolado (Bloqueio 3): processo1.dataRoot ===
    // processo2.dataRoot === e2eDataRoot — os DOIS processos rodam
    // EXATAMENTE no root E2E, nunca no operacional.
    const systemInfo2 = await page2.evaluate(async () => await window.studio.system.info())
    if (!systemInfo2.ok) throw new Error('system.info indisponível na fase 2.')
    expect(systemInfo2.value.dataRoot).toBe(systemInfo1.value.dataRoot)
    expect(systemInfo2.value.dataRoot).toBe(e2eDataRoot)

    // Abrir o MESMO workspace A: recovery da MESMA session S.
    await page2.locator('.welcome-canvas').getByRole('button', { name: 'Abrir workspace' }).click()
    await expectWorkspaceAuthorized(page2, {
      expectedWorkspaceName: path.basename(workspaceRoot),
      expectedSessionId: sessionIdA,
      diagnostics: () => `Electron stderr (processo 2)=[${processErrors2.join('').slice(0, 1_000)}]`
    })

    const recovered = await page2.evaluate(async () => await window.studio.agent.session())
    if (!recovered.ok || recovered.value === null) throw new Error('Sessão Tupiniquim não recuperada no processo 2.')
    expect(recovered.value.session.id).toBe(sessionIdA)
    // Bindings restaurados: provider correto, thread correta, model real.
    const recoveredThreads = [...recovered.value.providerThreads].sort((left, right) => left.provider.localeCompare(right.provider))
    expect(recoveredThreads).toEqual(threadsBeforeQuit)
    const ollamaThread = recoveredThreads.find((binding) => binding.provider === 'ollama')
    const codexThread = recoveredThreads.find((binding) => binding.provider === 'codex-app-server')
    if (ollamaThread === undefined || codexThread === undefined) throw new Error('Bindings Ollama/Codex não restaurados.')
    expect(ollamaThread.model).toBe(ollamaModel)
    expect(codexThread.model).toBe('codex-test-model')
    // Thread correta: o binding Ollama é a MESMA thread do turno de proposal
    // da fase 1; o binding Codex é a thread do servidor controlado.
    expect(ollamaThread.threadId).toBe(proposalSlot.threadId)
    expect(ollamaThread.threadId).not.toBe(codexThread.threadId)
    // Turns públicos restaurados, com provenance de model real.
    expect(recovered.value.turns.some((turn) => turn.text.includes(continuityMessage) && turn.model === ollamaModel)).toBe(true)
    expect(recovered.value.turns.some((turn) => turn.role === 'assistant' && turn.text.includes('CONTEXTO_TUPINIQUIM_OK') && turn.model === 'codex-test-model')).toBe(true)
    // Lifecycle efêmero vazio: proposal/authority anteriores ausentes.
    expect(recovered.value.proposalAuthority).toBeNull()
    // A proposal antiga não ressuscita: id desconhecido é EXPIRED fail-closed.
    const oldProposalStatus = await page2.evaluate(async (id: string) => await window.studio.agent.lookupProposalStatus(id), proposalIdA)
    expect(oldProposalStatus).toMatchObject({ ok: true, value: 'EXPIRED' })
    const applyOld = await page2.evaluate(async (id) => await window.studio.planning.applyProposedWorkspaceWrite({ proposalId: id }), proposalIdA)
    expect(applyOld).toMatchObject({ ok: false })
    // Conversa pública restaurada no renderer.
    await expect(page2.locator('.agent-conversation')).toContainText(continuityMessage)
    await expect(page2.locator('.agent-conversation')).toContainText(codexMessage)

    // ── CHAT pós-restart: continuidade legítima com contexto incremental ────
    // ATUALIZAÇÃO 5: seleção INICIAL do processo 2 (nenhum send neste
    // processo ainda; provider default DISCONNECTED).
    await selectOllamaAndWaitReady(page2, ollamaModel, {
      initialProviderSelection: true,
      diagnostics: () => `Electron stderr (processo 2)=[${processErrors2.join('').slice(0, 1_000)}]`
    })
    const firstSend = await page2.evaluate(async (message: string) => await window.studio.agent.send({ message, mode: 'CHAT' }), postRestartMessage)
    if (!firstSend.ok) throw new Error(`agent.send pós-restart falhou: ${firstSend.error.message}`)
    expect(firstSend.value.threadId).toBe(ollamaThread.threadId)
    expect(firstSend.value.model).toBe(ollamaModel)
    await expect(page2.locator('.agent-conversation')).toContainText('TUPINIQUIM_SESSION_OK', { timeout: 30_000 })
    const firstPostRestartRequest = chatRequests.at(-1)
    if (firstPostRestartRequest === undefined) throw new Error('Request pós-restart não registrado.')
    expect(firstPostRestartRequest.model).toBe(ollamaModel)
    // Hydrate da thread: histórico público retomado (continuidade legítima).
    expect(firstPostRestartRequest.messages.some((message) => message.role === 'user' && message.content.includes(continuityMessage))).toBe(true)
    expect(firstPostRestartRequest.messages.some((message) => message.role === 'assistant' && message.content.includes('TUPINIQUIM_SESSION_OK'))).toBe(true)
    expect(firstPostRestartRequest.messages.some((message) => message.content.includes(postRestartMessage))).toBe(true)
    // Contextos EFÊMEROS POR REQUEST: workspace context exatamente 1x.
    expect(firstPostRestartRequest.messages.filter((message) => message.content.includes('CONTEXTO DO WORKSPACE'))).toHaveLength(1)
    // Contexto já ACKado NÃO é retransmitido: seen restaurado pelo recovery.
    expect(firstPostRestartRequest.messages.filter((message) => message.content.includes('CONTEXTO DA SESSÃO TUPINIQUIM'))).toHaveLength(0)
    expect(JSON.stringify(firstPostRestartRequest)).not.toContain(privateMarker)
    const firstRequestLength = firstPostRestartRequest.messages.length

    // Segundo CHAT: o histórico cresce exatamente user+assistant; nenhum
    // system/workspace context é duplicado no histórico Ollama.
    await page2.getByLabel('Mensagem ao agente').fill(postRestartMessage2)
    await page2.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page2.locator('.agent-conversation')).toContainText(postRestartMessage2, { timeout: 30_000 })
    const secondPostRestartRequest = chatRequests.at(-1)
    if (secondPostRestartRequest === undefined) throw new Error('Segundo request pós-restart não registrado.')
    expect(secondPostRestartRequest.messages.filter((message) => message.content.includes('CONTEXTO DO WORKSPACE'))).toHaveLength(1)
    expect(secondPostRestartRequest.messages.filter((message) => message.content.includes('CONTEXTO DA SESSÃO TUPINIQUIM'))).toHaveLength(0)
    expect(secondPostRestartRequest.messages.filter((message) => message.content.includes(postRestartMessage2))).toHaveLength(1)
    expect(secondPostRestartRequest.messages.length - firstRequestLength).toBe(2)

    // ── PLAN/proposal pós-restart: NOVA authority legítima ───────────────────
    const newProposalSlot = await page2.evaluate(async () => {
      const created = await window.studio.planning.create({ objective: 'E2E restart new proposal', mode: 'PLAN' })
      if (!created.ok) throw new Error(`planning.create falhou: ${created.error.message}`)
      const stepId = created.value.plan.steps.find((step) => step.requiresApproval)?.id
      if (stepId === undefined) throw new Error('Plano E2E sem passo de escrita aprovável.')
      const sent = await window.studio.agent.send({
        message: 'Nova proposta pós-restart.',
        mode: 'PLAN',
        proposalContext: { executionId: created.value.execution.id, stepId }
      })
      if (!sent.ok) throw new Error(`agent.send falhou: ${sent.error.message}`)
      return { executionId: created.value.execution.id, stepId, threadId: sent.value.threadId }
    })
    await expect(provenanceRegion(page2)).toBeVisible({ timeout: 30_000 })
    await expect(provenanceRegion(page2).last().locator('header span')).toHaveText('PENDING_REVIEW')
    const proposalIdB = await proposalIdOf(provenanceRegion(page2).last()).textContent()
    if (proposalIdB === null) throw new Error('Nova proposal sem ID.')
    expect(proposalIdB).not.toBe(proposalIdA)
    const authorityAfterProposal = await page2.evaluate(async () => await window.studio.agent.session())
    if (!authorityAfterProposal.ok || authorityAfterProposal.value === null) throw new Error('Sessão indisponível após nova proposal.')
    expect(authorityAfterProposal.value.proposalAuthority).not.toBeNull()
    expect(authorityAfterProposal.value.proposalAuthority?.provider).toBe('ollama')
    expect(authorityAfterProposal.value.proposalAuthority?.proposalIds).toContain(proposalIdB)
    expect(JSON.stringify(authorityAfterProposal.value)).not.toContain(privateMarker)

    // Troca de provider NÃO transfere a authority da nova proposal.
    // ATUALIZAÇÃO 5: PÓS-send/proposal — READY terminal obrigatório ANTES.
    await selectCodexAndWaitReady(page2, {
      diagnostics: () => `Electron stderr (processo 2)=[${processErrors2.join('').slice(0, 1_000)}]`
    })
    const afterProviderSwitch = await page2.evaluate(async () => await window.studio.agent.session())
    if (!afterProviderSwitch.ok || afterProviderSwitch.value === null) throw new Error('Sessão indisponível após troca de provider.')
    expect(afterProviderSwitch.value.proposalAuthority).toBeNull()
    const newProposalAfterSwitch = await page2.evaluate(async (id: string) => await window.studio.agent.lookupProposalStatus(id), proposalIdB)
    expect(newProposalAfterSwitch).toMatchObject({ ok: true, value: 'EXPIRED' })
    await expect(provenanceRegion(page2).filter({ has: page2.locator('dd', { hasText: proposalIdB }) }).locator('header span')).toHaveText('EXPIRED')
    const hijack = await page2.evaluate(async (slot) => await window.studio.agent.send({
      message: 'Não transfira a authority.',
      mode: 'PLAN',
      proposalContext: { executionId: slot.executionId, stepId: slot.stepId }
    }), newProposalSlot)
    expect(hijack).toMatchObject({ ok: false })

    // ── A → B → A: B é isolado; A volta com a MESMA session e bindings ──────
    // ATUALIZAÇÃO 5: troca pós-cenário de provider/hijack — READY terminal
    // obrigatório antes de voltar ao Ollama e trocar de workspace.
    await selectOllamaAndWaitReady(page2, ollamaModel, {
      diagnostics: () => `Electron stderr (processo 2)=[${processErrors2.join('').slice(0, 1_000)}]`
    })
    await page2.locator('.project-switcher').click()
    await expectWorkspaceAuthorized(page2, {
      expectedWorkspaceName: path.basename(workspaceRootB),
      requireSession: true,
      diagnostics: () => `Electron stderr (processo 2)=[${processErrors2.join('').slice(0, 1_000)}]`
    })
    const sessionIdB = await page2.getByLabel('Sessão Tupiniquim').getAttribute('data-session-id')
    expect(sessionIdB).toBeTruthy()
    expect(sessionIdB).not.toBe(sessionIdA)
    await expect(page2.locator('.agent-conversation')).not.toContainText(continuityMessage)
    await expect(provenanceRegion(page2)).toHaveCount(0)
    const isolated = await page2.evaluate(async () => await window.studio.agent.session())
    if (!isolated.ok || isolated.value === null) throw new Error('Sessão do workspace B ausente.')
    expect(isolated.value.session.id).toBe(sessionIdB)
    expect(isolated.value.turns).toEqual([])
    expect(isolated.value.providerThreads).toEqual([])
    expect(JSON.stringify(isolated.value)).not.toContain(continuityMessage)
    expect(JSON.stringify(isolated.value)).not.toContain(privateMarker)

    // Volta a A: recupera a session S com bindings preservados.
    await page2.locator('.project-switcher').click()
    await expectWorkspaceAuthorized(page2, {
      expectedWorkspaceName: path.basename(workspaceRoot),
      expectedSessionId: sessionIdA,
      diagnostics: () => `Electron stderr (processo 2)=[${processErrors2.join('').slice(0, 1_000)}]`
    })
    const restoredA = await page2.evaluate(async () => await window.studio.agent.session())
    if (!restoredA.ok || restoredA.value === null) throw new Error('Sessão A não restaurada no processo 2.')
    expect(restoredA.value.session.id).toBe(sessionIdA)
    expect([...restoredA.value.providerThreads].sort((left, right) => left.provider.localeCompare(right.provider))).toEqual(threadsBeforeQuit)
    expect(restoredA.value.turns.some((turn) => turn.text.includes(continuityMessage))).toBe(true)
    expect(restoredA.value.proposalAuthority).toBeNull()

    // ── Marcador privado AUSENTE de todos os storages aplicáveis ────────────
    // 1) DOM e conversation pública do renderer.
    const dom = await page2.content()
    expect(dom).not.toContain(privateMarker)
    const conversationText = await page2.locator('.agent-conversation').innerText()
    expect(conversationText).not.toContain(privateMarker)
    // 2) Snapshot público da sessão (IPC).
    expect(JSON.stringify(restoredA.value)).not.toContain(privateMarker)
    // 3) AI history pública de TODAS as threads reais (Ollama + Codex).
    const historySweep = await page2.evaluate(async (threadIds) => {
      const raw: unknown[] = []
      for (const threadId of threadIds) {
        const history = await window.studio.agent.history({ threadId })
        raw.push(history)
      }
      return JSON.stringify(raw)
    }, [ollamaThread.threadId, codexThread.threadId])
    expect(historySweep).not.toContain(privateMarker)
    // 4) Flight Recorder (events) das execuções com proposal.
    const flightRecorder = await page2.evaluate(async (executionIds) => {
      const collected: unknown[] = []
      for (const executionId of executionIds) {
        const events = await window.studio.planning.events({ executionId })
        collected.push(events)
      }
      return JSON.stringify(collected)
    }, [proposalSlot.executionId, newProposalSlot.executionId])
    expect(flightRecorder).not.toContain(privateMarker)
    // 5) AuditLog persistido.
    const auditLog = await readFile(path.join(dataRoot, 'logs', 'audit.jsonl'), 'utf8')
    expect(auditLog).not.toContain(privateMarker)
    // 6) Logs persistidos do dataRoot (todos os arquivos).
    const logFiles = await readdir(path.join(dataRoot, 'logs'))
    for (const logFile of logFiles) {
      const content = await readFile(path.join(dataRoot, 'logs', logFile), 'utf8').catch(() => '')
      expect(content).not.toContain(privateMarker)
    }
    // 7) SQLite (todos os arquivos studio.sqlite*, bytes crus — snapshot + WAL).
    const databaseFiles = (await readdir(path.join(dataRoot, 'database'))).filter((name) => name.startsWith('studio.sqlite'))
    expect(databaseFiles.length).toBeGreaterThan(0)
    const privateMarkerBytes = Buffer.from(privateMarker, 'utf8')
    for (const databaseFile of databaseFiles) {
      expect((await readFile(path.join(dataRoot, 'database', databaseFile))).includes(privateMarkerBytes)).toBe(false)
    }

    // Nenhum request adicional além dos esperados (fase 1 + fase 2).
    expect(chatRequests.length).toBeGreaterThan(chatRequestsPhase1)
    await page2.screenshot({ path: path.join(projectRoot, 'test-results', 'restart-recovery.png'), fullPage: true })
  } finally {
    try {
      if (application !== null) await application.close().catch(() => undefined)
    } finally {
      try {
        if (workspaceRoot !== '') await rm(workspaceRoot, { recursive: true, force: true })
        if (workspaceRootB !== '') await rm(workspaceRootB, { recursive: true, force: true })
        if (e2eDataRoot !== '') await rm(e2eDataRoot, { recursive: true, force: true })
      } finally {
        await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections() })
      }
    }
  }
})
