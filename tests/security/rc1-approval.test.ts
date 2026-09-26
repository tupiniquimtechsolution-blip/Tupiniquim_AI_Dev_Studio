import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'

it('RC1 native approval remains one-shot, deny by default and separate from agent effects', async () => {
  const main = await readFile('apps/desktop/src/main/index.ts', 'utf8')
  expect(main).toContain("buttons: ['Cancelar', 'Autorizar uma vez'], defaultId: 0, cancelId: 0")
  expect(main).toContain('approved = confirmation.response === 1')
  expect(main).toContain('workspace.getRoot() !== approvedWorkspace')
  expect(main).toContain("if (!decision.allowed)")
  expect(main).toContain('registerApprovedProposedWorkspaceWrite()')
  const allowed = /const interactive = new Set\(\[([^\]]+)\]/u.exec(main)?.[1]
  expect(allowed).not.toContain('terminal.write')
  expect(allowed).not.toContain('execution.')
})
