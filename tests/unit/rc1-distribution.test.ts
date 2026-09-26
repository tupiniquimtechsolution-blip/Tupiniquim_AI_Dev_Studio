import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'

it('keeps the merged Google Tasks bootstrap at the package main entry', async () => {
  const config = await readFile('electron.vite.config.ts', 'utf8')
  const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { main: string; build: { directories: { output: string } } }
  expect(pkg.main).toBe('out/main/index.js')
  expect(config).toContain("input: path.join(root, 'apps/desktop/src/main/bootstrap.ts')")
  expect(config).toContain("output: { format: 'es', entryFileNames: 'index.js' }")
  expect(pkg.build.directories.output).toBe('release')
})

it('ships model tiers without automatic selection or an unbounded download catalog', async () => {
  const manifest = JSON.parse(await readFile('config/local-models.json', 'utf8')) as { models: { name: string; tier: string; estimatedDownloadGB: number }[] }
  expect(new Set(manifest.models.map((model) => model.tier))).toEqual(new Set(['required', 'recommended', 'optional']))
  expect(manifest.models.every((model) => model.name.includes(':') && model.estimatedDownloadGB > 0)).toBe(true)
  expect(new Set(manifest.models.map((model) => model.name)).size).toBe(manifest.models.length)
})

it('bundles Monaco locally instead of depending on the default CDN', async () => {
  const config = await readFile('apps/desktop/src/renderer/src/monaco.ts', 'utf8')
  expect(config).toContain('loader.config({ monaco })')
  expect(config).toContain('editor.worker?worker')
  expect(await readFile('apps/desktop/src/renderer/src/main.tsx', 'utf8')).toContain("import './monaco'")
})
