import { describe, expect, it } from 'vitest'
import { GitAdapter } from '@tupiniquim/adapters'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const execFileAsync = promisify(execFile)

describe('GitAdapter', () => {
  it('does not discover a repository above the authorized workspace', async () => {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'git-parent-fixture-'))
    try {
      await execFileAsync('git', ['init', '--initial-branch', 'parent-fixture'], { cwd: parent })
      const child = path.join(parent, 'authorized-workspace')
      await fs.mkdir(child)
      await expect(new GitAdapter(() => child).status()).rejects.toThrow()
    } finally { await fs.rm(parent, { recursive: true, force: true }) }
  })
  it.skipIf(process.platform === 'win32')('does not execute repository fsmonitor hooks during a read-only status query', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'git-monitor-fixture-'))
    try {
      await execFileAsync('git', ['init', '--initial-branch', 'fixture'], { cwd: root })
      const hook = path.join(root, '.git', 'controlled-fsmonitor')
      await fs.writeFile(hook, '#!/bin/sh\nprintf invoked > fsmonitor-marker\nprintf "/\\n"\n', { mode: 0o755 })
      await execFileAsync('git', ['config', 'core.fsmonitor', hook], { cwd: root })
      await new GitAdapter(() => root).status()
      await expect(fs.access(path.join(root, 'fsmonitor-marker'))).rejects.toThrow()
    } finally { await fs.rm(root, { recursive: true, force: true }) }
  })
  it('reads actual renamed, modified and untracked filenames containing spaces', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'git-status-fixture-'))
    const git = (args: string[]) => execFileAsync('git', args, { cwd: root, windowsHide: true })
    try {
      await git(['init', '--initial-branch', 'fixture'])
      await git(['config', 'user.name', 'Synthetic CI Fixture']); await git(['config', 'user.email', 'fixture@example.test'])
      await fs.writeFile(path.join(root, 'staged old name.txt'), 'rename fixture')
      await fs.writeFile(path.join(root, 'modified file.txt'), 'baseline')
      await git(['add', '--', 'staged old name.txt', 'modified file.txt'])
      await git(['-c', 'commit.gpgSign=false', 'commit', '-m', 'Synthetic fixture baseline'])
      await git(['mv', '--', 'staged old name.txt', 'renamed target.txt'])
      await fs.writeFile(path.join(root, 'modified file.txt'), 'changed')
      await fs.writeFile(path.join(root, 'new space file.txt'), 'untracked')
      const status = await new GitAdapter(() => root).status()
      expect(status.branch).toBe('fixture')
      expect(status.entries).toEqual(expect.arrayContaining([
        { path: 'renamed target.txt', index: 'R', worktree: '.' },
        { path: 'modified file.txt', index: '.', worktree: 'M' },
        { path: 'new space file.txt', index: '?', worktree: '?' }
      ]))
      expect(status.entries).toHaveLength(3)
    } finally { await fs.rm(root, { recursive: true, force: true }) }
  })
  it('consulta o status com safe.directory somente para o workspace atual', async () => {
    const status = await new GitAdapter(() => process.cwd()).status()
    expect(status.branch).not.toBe('')
    expect(Array.isArray(status.entries)).toBe(true)
  })
})
