import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { HttpResearchProvider } from '@tupiniquim/adapters'

describe('HttpResearchProvider live', () => {
  it.runIf(process.env.TUPINIQUIM_LIVE_RESEARCH_TEST === '1')('pesquisa a web por HTTP e grava o cache em D', async () => {
    const dataRoot = path.join('F:\\CODEX\\Tupiniquim-AI-Dev-Studio.data', 'tests', 'research')
    const result = await new HttpResearchProvider(dataRoot).search('Electron official security checklist', 5)
    expect(result.sources.length).toBeGreaterThan(0)
    expect(result.sources.every((source) => source.trust === 'EXTERNAL_UNTRUSTED')).toBe(true)
    expect(path.parse(dataRoot).root.toUpperCase()).toBe('F:\\')
  }, 45_000)
})
