import { describe, expect, it } from 'vitest'
import { TechnologyResolutionEngine } from './technology-resolution'

describe('TechnologyResolutionEngine', () => {
  it('favorece stacks compatíveis com requisitos e toolchains reais', () => {
    const resolution = new TechnologyResolutionEngine().resolve('Aplicação desktop-first com terminal, Monaco e Node; também WEB e MOBILE cross-platform.', ['WEB', 'DESKTOP', 'MOBILE'], ['node', 'pnpm'])
    expect(resolution.recommendations.find((candidate) => candidate.platform === 'DESKTOP')?.name).toBe('Electron')
    expect(resolution.recommendations.find((candidate) => candidate.platform === 'MOBILE')?.name).toBe('Expo + React Native')
    expect(resolution.knowledgePack.citations.length).toBeGreaterThan(2)
  })
})
