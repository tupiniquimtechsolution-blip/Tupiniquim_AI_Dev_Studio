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
  executionRuntime?: { state?: string; configured?: boolean; online?: boolean; capabilities?: string[] }
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

/**
 * Web Product Experience: a raiz `/` apresenta a landing pública no primeiro
 * acesso; o Studio chat-first abre após a entrada explícita (CTA
 * "Abrir Studio") e a raiz passa a levar direto ao Studio nas visitas
 * seguintes (flag local — mesma semântica de recovery anterior, quando `/`
 * já era a superfície autenticada).
 */
const enterStudio = async (page: Page): Promise<void> => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const openStudio = page.getByRole('button', { name: 'Abrir Studio', exact: true }).first()
  const studioBrand = page.locator('.web-studio .brand')
  await expect(openStudio.or(studioBrand).first()).toBeVisible()
  if (await openStudio.isVisible()) await openStudio.click()
  await expect(studioBrand).toContainText('Tupiniquim')
}

test.describe.configure({ mode: 'serial' })

test('health diferencia funcional de production-ready sem PASS fictício', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.ok(), `health HTTP ${response.status()}`).toBe(true)

  const health = await response.json() as HealthEnvelope
  expect(health.ok).toBe(true)
  expect(health.runtime).toBe('cloudflare-edge')
  expect(health.ai).toBe('workers-ai')
  expect(health.auth?.state).not.toBe('MISCONFIGURED')
  expect(health.workspacePersistence?.state).not.toBe('MISCONFIGURED')

  if (requireProductionReady) {
    expect(health.auth).toMatchObject({ state: 'ACCESS_READY', productionReady: true })
    expect(health.executionRuntime).toMatchObject({ state: 'READY', configured: true, online: true })
    expect(health.executionRuntime?.capabilities).toContain('local-persistence')
    expect(health.workspacePersistence?.state).not.toBe('MISCONFIGURED')
  }
})

test('workspace RPC escreve, lê e cria checkpoint com isolamento por workspace', async ({ request }) => {
  const healthResponse = await request.get('/api/health')
  const health = await healthResponse.json() as HealthEnvelope
  test.skip(health.executionRuntime?.state !== 'READY', 'Remote Runtime offline: workspace executável é testado somente quando o gateway está conectado.')

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

test('landing pública apresenta o produto e leva ao onboarding conversacional', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Do pedido ao código executável')
  await expect(page.getByRole('link', { name: 'Como funciona' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Começar', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Boas-vindas ao Studio.' })).toBeVisible()
  await page.getByRole('button', { name: 'Vamos lá' }).click()
  await expect(page.getByRole('heading', { name: 'Como você pretende usar o Studio?' })).toBeVisible()
  await page.getByRole('button', { name: 'Programação', exact: false }).click()
  await expect(page.getByRole('heading', { name: 'Qual o seu nível hoje?' })).toBeVisible()
})

test('tema Claro/Escuro/Sistema aplica data-theme, persiste no reload e não quebra a navegação', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const html = page.locator('html')
  // SYSTEM é o padrão da superfície Web: o tema resolvido já está aplicado.
  await expect(html).toHaveAttribute('data-theme', /^(light|dark)$/)

  const themeGroup = page.getByRole('group', { name: 'Tema da interface' }).first()
  await themeGroup.getByRole('button', { name: 'Tema escuro' }).click()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await expect(themeGroup.getByRole('button', { name: 'Tema escuro' })).toHaveAttribute('aria-pressed', 'true')

  // Persistência: reload mantém o escuro sem flash de preferência perdida.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.getByRole('group', { name: 'Tema da interface' }).first()
    .getByRole('button', { name: 'Tema claro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  // Navegação continua íntegra com o tema trocado (landing → onboarding).
  await page.getByRole('button', { name: 'Começar', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Boas-vindas ao Studio.' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('UI Web Full inicializa workspace/modelo, conversa e recupera sessão; terminal quando o Remote Runtime está online', async ({ page, request }) => {
  await enterStudio(page)
  await expect(page.locator('.web-studio .brand')).toContainText('Tupiniquim')
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
  // Regressão RG-01/RG-02: a resposta renderizada deve ser texto de conversa,
  // nunca o envelope OpenAI-compatible bruto (choices/usage/model) nem
  // reasoning_content vazado pelo fallback JSON.stringify.
  const assistantText = (await assistant.innerText()).toLowerCase()
  for (const leaked of ['"choices"', 'reasoning_content', '"usage"', 'completion_tokens', '"finish_reason"']) {
    expect(assistantText, `resposta do chat vazou payload bruto (${leaked})`).not.toContain(leaked)
  }
  await expect(page.locator('.agent-message.error')).toHaveCount(0)

  const healthResponse = await request.get('/api/health')
  const health = await healthResponse.json() as HealthEnvelope
  if (health.executionRuntime?.state === 'READY') {
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
  }

  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForWebWorkspace(page)
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await expect(page.locator('.agent-message.user')).toContainText(marker)
  await expect(page.locator('.agent-message.assistant[data-provider="cloudflare-workers-ai"]')).toHaveCount(assistantCount + 1)
})
