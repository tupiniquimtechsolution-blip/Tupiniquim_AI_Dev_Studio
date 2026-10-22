import { describe, expect, it } from 'vitest'
import { shortcutsSchema } from '../../packages/contracts/src/shortcuts'
import { uiProfileSchema } from '../../packages/contracts/src/settings'
import { createDefaultProfile } from '../../packages/core/src/preferences'

describe('Opt-in navigation shortcuts', () => {
  it('preserves legacy profiles and accepts empty or distinct bindings', () => {
    expect(uiProfileSchema.parse(createDefaultProfile()).shortcuts).toBeUndefined()
    expect(shortcutsSchema.parse({ composer: '', files: 'Mod+Alt+KeyF' }).files).toBe('Mod+Alt+KeyF')
  })
  it('rejects duplicates, unknown commands and reserved plain modifier keys', () => {
    expect(shortcutsSchema.safeParse({ files: 'Mod+Alt+KeyF', prompts: 'Mod+Alt+KeyF' }).success).toBe(false)
    expect(shortcutsSchema.safeParse({ files: 'Mod+KeyS' }).success).toBe(false)
    expect(shortcutsSchema.safeParse({ execute: 'Mod+Alt+KeyE' }).success).toBe(false)
  })
})
