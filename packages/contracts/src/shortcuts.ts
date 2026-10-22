import { z } from 'zod'

export const shortcutActions = ['composer', 'files', 'prompts', 'activity'] as const
export type ShortcutAction = typeof shortcutActions[number]
// Opt-in navigation only. A narrow grammar avoids browser-reserved plain Mod keys.
export const shortcutsSchema = z.object({
  composer: z.string().regex(/^$|^Mod\+Alt\+Key[A-Z]$/).optional(),
  files: z.string().regex(/^$|^Mod\+Alt\+Key[A-Z]$/).optional(),
  prompts: z.string().regex(/^$|^Mod\+Alt\+Key[A-Z]$/).optional(),
  activity: z.string().regex(/^$|^Mod\+Alt\+Key[A-Z]$/).optional()
}).strict().superRefine((bindings, ctx) => {
  const seen = new Set<string>()
  for (const action of shortcutActions) {
    const binding = bindings[action]
    if (!binding) continue
    if (seen.has(binding)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [action], message: 'Atalho duplicado.' })
    seen.add(binding)
  }
})
export type Shortcuts = z.infer<typeof shortcutsSchema>
