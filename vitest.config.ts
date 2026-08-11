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
      { resolve: { alias: aliases }, test: { name: 'unit', include: ['packages/**/*.unit.test.ts'] } },
      { resolve: { alias: aliases }, test: { name: 'integration', include: ['tests/integration/**/*.test.ts'] } },
      { resolve: { alias: aliases }, test: { name: 'security', include: ['tests/security/**/*.test.ts'] } },
      { resolve: { alias: aliases }, test: { name: 'dogfood', include: ['tests/dogfood/**/*.test.ts'] } }
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage'
    }
  }
})
