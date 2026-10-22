import { defineConfig } from '@playwright/test'

// Executed only by explicit CI command, never a production smoke substitute.
export default defineConfig({
  testDir: './tests/hosted-ui',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-hosted', open: 'never' }]],
  outputDir: 'test-results/hosted-ui',
  use: { baseURL: 'http://127.0.0.1:8787', browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    {
      command: 'node apps/runtime-gateway/src/server.ts',
      port: 43721,
      timeout: 60_000,
      reuseExistingServer: false,
      env: { TUPINIQUIM_GATEWAY_HOST: '127.0.0.1', TUPINIQUIM_GATEWAY_PORT: '43721', TUPINIQUIM_GATEWAY_ROOT: '.cache/hosted-ui/runtime', TUPINIQUIM_GATEWAY_TOKEN: 'synthetic-loopback-ci-fixture-only' }
    },
    {
      command: 'pnpm exec wrangler dev --config wrangler.hosted-ui.jsonc --local --port 8787 --persist-to .cache/hosted-ui/worker',
      url: 'http://127.0.0.1:8787/api/health',
      timeout: 120_000,
      reuseExistingServer: false
    }
  ]
})
