import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@tupiniquim/contracts': path.join(root, 'packages/contracts/src/index.ts'),
        '@tupiniquim/core': path.join(root, 'packages/core/src/index.ts'),
        '@tupiniquim/adapters': path.join(root, 'packages/adapters/src/index.ts')
      }
    },
    build: {
      rollupOptions: {
        input: path.join(root, 'apps/desktop/src/main/index.ts'),
        external: ['electron', 'node-pty']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@tupiniquim/contracts': path.join(root, 'packages/contracts/src/index.ts')
      }
    },
    build: {
      rollupOptions: {
        input: path.join(root, 'apps/desktop/src/preload/index.ts'),
        external: ['electron'],
        output: {
          format: 'cjs',
          entryFileNames: 'index.cjs'
        }
      }
    }
  },
  renderer: {
    root: path.join(root, 'apps/desktop/src/renderer'),
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true
    },
    resolve: {
      alias: {
        '@tupiniquim/contracts': path.join(root, 'packages/contracts/src/index.ts'),
        '@tupiniquim/core': path.join(root, 'packages/core/src/index.ts'),
        '@tupiniquim/ui': path.join(root, 'packages/ui/src/index.ts')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: path.join(root, 'apps/desktop/src/renderer/index.html')
      }
    }
  }
})
