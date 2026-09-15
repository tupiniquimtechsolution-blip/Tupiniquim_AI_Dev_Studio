import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))
const aliases = {
  '@tupiniquim/contracts': path.join(root, 'packages/contracts/src/index.ts'),
  '@tupiniquim/core': path.join(root, 'packages/core/src/index.ts'),
  '@tupiniquim/adapters': path.join(root, 'packages/adapters/src/index.ts'),
  '@tupiniquim/ui': path.join(root, 'packages/ui/src/index.ts')
}

export default defineConfig({
  resolve: { alias: aliases },
  test: {
    projects: [
      // Wave 17 — Issue #25: regras puras do renderer (ex.: fronteira de envio
      // fail-closed do provider) são testadas no gate unit, sem Electron/DOM.
      { resolve: { alias: aliases }, test: { name: 'unit', include: ['packages/**/*.unit.test.ts', 'apps/**/*.unit.test.ts'] } },
      { resolve: { alias: aliases }, test: { name: 'integration', include: ['tests/integration/**/*.test.ts'], testTimeout: 30_000, hookTimeout: 30_000 } },
      { resolve: { alias: aliases }, test: { name: 'security', include: ['tests/security/**/*.test.ts'], testTimeout: 30_000, hookTimeout: 30_000 } },
      { resolve: { alias: aliases }, test: { name: 'dogfood', include: ['tests/dogfood/**/*.test.ts'], testTimeout: 30_000, hookTimeout: 30_000 } }
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage'
    }
  }
})
