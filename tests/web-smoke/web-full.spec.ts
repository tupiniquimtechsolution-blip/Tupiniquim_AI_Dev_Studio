import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

interface RpcError {
  code: string
  message: string
  retryable: boolean
}

interface RpcEnvelope<T = unknown> {
  ok: boolean
  value?: T
  error?: RpcError
  persistence?: { state?: string; configured?: boolean }
}

interface HealthEnvelope {
  ok?: boolean
  product?: string
  runtime?: string
  ai?: string
  auth?: { state?: string; productionReady?: boolean }
  workspacePersistence?: { state?: string; configured?: boolean; missing?: string[] }
}

const requireProductionReady = process.env.WEB_SMOKE_REQUIRE_PRODUCTION_READY === 'true'

const postStudio = async <T>(
  request: APIRequestContext,
  workspaceId: string,
  action: string,
  input?: unknown
): Promise<RpcEnvelope<T>> => {
  const response = await request.post('/api/studio', {
    headers: {
      'content-type': 'application/json',
      'x-tupiniquim-workspace': workspaceId
    },
    data: input === undefined ? { action } : { action, input }
  })
  const body = await response.json() as RpcEnvelope<T>
  expect(response.ok(), `${action} HTTP ${response.status()}: ${body.error?.message ?? 'sem detalhe'}`).toBe(true)
  expect(body.ok, `${action}: ${body.error?.message ?? 'RPC retornou ok=false'}`).toBe(true)
  return body
}

const waitForWebWorkspace = async (page: Page): Promise<void> => {
  const projectSwitcher = page.locator('.project-switcher')
  await expect(projectSwitcher).toBeVisible()
  await expect(projectSwitcher).not.toContainText('Nenhum projeto', { timeout: 120_000 })
  await expect(page.locator('.statusbar')).toContainText('/workspace')
}

test.describe.configure({ mode: 'serial' })

test('health diferencia funcional de production-ready sem PASS fictício', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.ok(), `health HTTP ${response.status()}`).toBe(true)

  const health = await response.json() as HealthEnvelope
  expect(health.ok).toBe(true)
  expect(health.runtime).toBe('cloudflare-sandbox')
  expect(health.ai).toBe('workers-ai')
  expect(health.auth?.state).not.toBe('MISCONFIGURED')
  expect(health.workspacePersistence?.state).not.toBe('MISCONFIGURED')

  if (requireProductionReady) {
    expect(health.auth).toMatchObject({ state: 'ACCESS_READY', productionReady: true })
    expect(health.workspacePersistence).toMatchObject({ state: 'READY', configured: true })
  }
})

test('workspace RPC escreve, lê e cria checkpoint com isolamento por workspace', async ({ request }) => {
  const workspaceId = `web-smoke-${randomUUID()}`
  const relativePath = '.tupiniquim-web/product-smoke.txt'
  const marker = `TUPINIQUIM_WEB_FILE_SMOKE_${Date.now()}`

  const bootstrap = await postStudio<string>(request, workspaceId, 'full.workspace.bootstrap')
  expect(bootstrap.value).toBe('/workspace')
  expect(bootstrap.persistence?.state).not.toBe('MISCONFIGURED')

  const written = await postStudio<{ relativePath: string; content: string; hash: string }>(
    request,
    workspaceId,
    'workspace.write',
    { relativePath, content: marker }
  )
  expect(written.value).toMatchObject({ relativePath, content: marker })
  expect(written.value?.hash).toMatch(/^[a-f0-9]{64}$/)
  expect(written.persistence?.state).not.toBe('MISCONFIGURED')

  const read = await postStudio<{ relativePath: string; content: string; hash: string }>(
    request,
    workspaceId,
    'workspace.read',
    { relativePath }
  )
  expect(read.value).toMatchObject({ relativePath, content: marker, hash: written.value?.hash })

  const checkpoint = await postStudio<{ state: string; configured: boolean }>(
    request,
    workspaceId,
    'full.workspace.checkpoint'
  )
  expect(checkpoint.value?.state).not.toBe('MISCONFIGURED')
  if (requireProductionReady) {
    expect(checkpoint.value).toMatchObject({ state: 'SNAPSHOT', configured: true })
  }
})

test('UI Web Full inicializa workspace/modelo, conversa, usa terminal e recupera sessão no reload', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.brand')).toContainText('Tupiniquim')
  await waitForWebWorkspace(page)

  const provider = page.getByLabel('Provedor de IA')
  await expect(provider).toHaveValue('cloudflare-workers-ai')

  const model = page.getByLabel('Modelo de IA')
  await expect(model).toBeVisible()
  const selectedModel = await model.inputValue()
  expect(selectedModel).toMatch(/^@cf\//)

  await page.getByRole('button', { name: 'Chat', exact: true }).click()

  const marker = `TUPINIQUIM_WEB_CHAT_SMOKE_${Date.now()}`
  const composer = page.getByLabel('Mensagem ao agente')
  await composer.fill(`Teste funcional. Responda de forma curta confirmando que recebeu o marcador: ${marker}`)

  const send = page.getByRole('button', { name: 'Enviar', exact: true })
  await expect(send).toBeEnabled()
  const assistants = page.locator('.agent-message.assistant[data-provider="cloudflare-workers-ai"]')
  const assistantCount = await assistants.count()

  await send.click()
  await expect(page.locator('.agent-message.user').last()).toContainText(marker)
  const assistant = assistants.nth(assistantCount)
  await expect(assistant).toBeVisible({ timeout: 180_000 })
  await expect(assistant.locator('p')).not.toHaveText('')
  await expect(page.locator('.agent-message.error')).toHaveCount(0)

  const terminalMarker = `TUPINIQUIM_TERMINAL_SMOKE_${Date.now()}`
  const terminalResult = await page.evaluate(async (expectedMarker) => {
    interface TerminalEvent {
      terminalId: string
      data: string
      exited?: boolean
      exitCode?: number
    }
    interface SmokeStudio {
      terminal: {
        create(input: { cwd: string; cols: number; rows: number }): Promise<{ ok: boolean; value?: { terminalId: string }; error?: { message: string } }>
        write(input: { terminalId: string; data: string }): Promise<{ ok: boolean; error?: { message: string } }>
        kill(input: { terminalId: string }): Promise<unknown>
        onData(listener: (event: TerminalEvent) => void): () => void
      }
    }

    const studio = (window as unknown as { studio: SmokeStudio }).studio
    return await new Promise<{ ok: boolean; detail: string }>((resolve) => {
      let terminalId: string | null = null
      let settled = false
      let output = ''
      const finish = (result: { ok: boolean; detail: string }): void => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        unsubscribe()
        if (terminalId !== null) void studio.terminal.kill({ terminalId })
        resolve(result)
      }
      const unsubscribe = studio.terminal.onData((event) => {
        if (terminalId === null || event.terminalId !== terminalId) return
        output += event.data
        if (output.includes(expectedMarker)) finish({ ok: true, detail: output.slice(-2000) })
        if (event.exited === true && !output.includes(expectedMarker)) finish({ ok: false, detail: `terminal exited ${event.exitCode ?? 0}: ${output.slice(-2000)}` })
      })
      const timeout = setTimeout(() => finish({ ok: false, detail: `timeout: ${output.slice(-2000)}` }), 30_000)

      void studio.terminal.create({ cwd: '', cols: 100, rows: 30 }).then(async (created) => {
        if (!created.ok || created.value === undefined) {
          finish({ ok: false, detail: created.error?.message ?? 'terminal.create falhou' })
          return
        }
        terminalId = created.value.terminalId
        const write = await studio.terminal.write({
          terminalId,
          data: `printf '${expectedMarker}\\n'\n`
        })
        if (!write.ok) finish({ ok: false, detail: write.error?.message ?? 'terminal.write falhou' })
      })
    })
  }, terminalMarker)
  expect(terminalResult.ok, terminalResult.detail).toBe(true)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForWebWorkspace(page)
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await expect(page.locator('.agent-message.user')).toContainText(marker)
  await expect(page.locator('.agent-message.assistant[data-provider="cloudflare-workers-ai"]')).toHaveCount(assistantCount + 1)
})
