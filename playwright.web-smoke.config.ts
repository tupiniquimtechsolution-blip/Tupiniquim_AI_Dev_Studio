import { defineConfig } from '@playwright/test'

const baseURL = process.env.WEB_SMOKE_BASE_URL?.trim()
if (!baseURL) throw new Error('WEB_SMOKE_BASE_URL é obrigatório para o Web Product Smoke.')

const accessClientId = process.env.WEB_SMOKE_ACCESS_CLIENT_ID?.trim() ?? ''
const accessClientSecret = process.env.WEB_SMOKE_ACCESS_CLIENT_SECRET?.trim() ?? ''
if ((accessClientId === '') !== (accessClientSecret === '')) {
  throw new Error('WEB_SMOKE_ACCESS_CLIENT_ID e WEB_SMOKE_ACCESS_CLIENT_SECRET devem ser configurados juntos.')
}

const accessHeaders = accessClientId === ''
  ? {}
  : {
      'CF-Access-Client-Id': accessClientId,
      'CF-Access-Client-Secret': accessClientSecret
    }

export default defineConfig({
  testDir: './tests/web-smoke',
  timeout: 240_000,
  expect: { timeout: 120_000 },
  workers: 1,
  retries: 0,
  fullyParallel: false,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-web', open: 'never' }]
  ],
  outputDir: 'test-results/web-product-smoke',
  use: {
    baseURL,
    ...Object.keys(accessHeaders).length > 0 ? { extraHTTPHeaders: accessHeaders } : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'web-product-smoke',
      use: { browserName: 'chromium' }
    }
  ]
})
