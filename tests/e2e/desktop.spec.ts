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

    const configured = await page.evaluate(async (root) => window.studio.workspace.configure({ root }), projectRoot)
    expect(configured.ok).toBe(true)
    const tree = await page.evaluate(async () => window.studio.workspace.list({ relativePath: '', depth: 2 }))
    expect(tree.ok).toBe(true)

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
