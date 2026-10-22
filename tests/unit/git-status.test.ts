import { describe, expect, it } from 'vitest'
import { parseGitStatus } from '../../packages/adapters/src/git-status'

describe('Porcelain v2 NUL-delimited status', () => {
  it('preserves raw names, consumes rename origins and includes conflicts', () => {
    const raw = ['# branch.head feature/example', '# branch.upstream origin/feature/example', '# branch.ab +2 -3', '1 .M N... 100644 100644 100644 abc def   leading and trailing  ', '2 R. N... 100644 100644 100644 abc def R100 renamed target.txt', '? not an untracked origin.txt', 'u UU N... 100644 100644 100644 100644 abc def ghi conflict name.txt', '? actual\nnew file.txt', ''].join('\0')
    const result = parseGitStatus(raw)
    expect(result).toMatchObject({ branch: 'feature/example', upstream: 'origin/feature/example', ahead: 2, behind: 3 })
    expect(result.entries).toEqual([
      { path: '  leading and trailing  ', index: '.', worktree: 'M' },
      { path: 'renamed target.txt', index: 'R', worktree: '.' },
      { path: 'conflict name.txt', index: 'U', worktree: 'U' },
      { path: 'actual\nnew file.txt', index: '?', worktree: '?' }
    ])
  })
})
