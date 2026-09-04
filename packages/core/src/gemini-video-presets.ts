export const geminiVideoPresetIds = ['reveal', 'teardown', 'explodedview'] as const

export type GeminiVideoPresetId = (typeof geminiVideoPresetIds)[number]

export interface GeminiVideoPreset {
  id: GeminiVideoPresetId
  alias: `/${GeminiVideoPresetId}`
  label: string
  medium: 'VIDEO'
  officialGeminiCommand: false
  prompt: string
}

export interface ResolvedGeminiVideoPreset {
  preset: GeminiVideoPreset
  subject: string | null
  expandedPrompt: string
}

const presets: Record<GeminiVideoPresetId, GeminiVideoPreset> = {
  reveal: {
    id: 'reveal',
    alias: '/reveal',
    label: 'Product Reveal',
    medium: 'VIDEO',
    officialGeminiCommand: false,
    prompt: 'Create a short cinematic product reveal video from the provided reference. Preserve the product identity and proportions. Start with a restrained partial view, then reveal the full subject using controlled camera motion and studio lighting. Keep the background clean, motion smooth and physically plausible. Do not alter labels, branding or visible product details.'
  },
  teardown: {
    id: 'teardown',
    alias: '/teardown',
    label: 'Technical Teardown',
    medium: 'VIDEO',
    officialGeminiCommand: false,
    prompt: 'Create a short technical teardown animation from the provided reference. Preserve the exterior identity. Progressively disassemble the subject into major components in a readable order, with smooth controlled motion and stable camera framing. If internal parts are not evidenced by the reference, present them as conceptual rather than factual. Do not invent labels or brand changes.'
  },
  explodedview: {
    id: 'explodedview',
    alias: '/explodedview',
    label: 'Exploded View',
    medium: 'VIDEO',
    officialGeminiCommand: false,
    prompt: 'Create a short exploded-view animation from the provided reference. Separate the major components along clear spatial axes while preserving their relative assembly positions. Use clean technical/studio lighting, smooth motion and a stable perspective. If internals are not evidenced, keep the visualization conceptual. Do not add unsupported components, text or logos.'
  }
}

export function listGeminiVideoPresets(): GeminiVideoPreset[] {
  return geminiVideoPresetIds.map((id) => presets[id])
}

export function resolveGeminiVideoPreset(input: string): ResolvedGeminiVideoPreset | null {
  const match = input.trim().match(/^\/(reveal|teardown|explodedview)(?:\s+(.+))?$/i)
  if (match === null) return null

  const id = match[1]?.toLowerCase() as GeminiVideoPresetId
  const subject = match[2]?.trim() || null
  const preset = presets[id]
  const expandedPrompt = subject === null ? preset.prompt : `Subject/context: ${subject}\n\n${preset.prompt}`

  return { preset, subject, expandedPrompt }
}
