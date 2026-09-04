import { describe, expect, it } from 'vitest'
import { listGeminiVideoPresets, resolveGeminiVideoPreset } from './gemini-video-presets'

describe('Gemini video prompt presets', () => {
  it('registra apenas os aliases confirmados no vídeo e não os chama de comandos oficiais', () => {
    const presets = listGeminiVideoPresets()
    expect(presets.map((preset) => preset.alias)).toEqual(['/reveal', '/teardown', '/explodedview'])
    expect(presets.every((preset) => preset.officialGeminiCommand === false)).toBe(true)
  })

  it('expande alias com contexto sem executar rede', () => {
    const resolved = resolveGeminiVideoPreset('/explodedview controle de videogame')
    expect(resolved?.subject).toBe('controle de videogame')
    expect(resolved?.expandedPrompt).toContain('controle de videogame')
    expect(resolved?.expandedPrompt).toContain('exploded-view')
  })

  it('ignora aliases desconhecidos', () => {
    expect(resolveGeminiVideoPreset('/unknown produto')).toBeNull()
  })
})
