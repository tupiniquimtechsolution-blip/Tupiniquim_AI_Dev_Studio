import type { GitStatus } from '@tupiniquim/contracts'

/** Porcelain v2 -z: filenames are raw and rename origins occupy a second NUL record. */
export const parseGitStatus = (raw: string): GitStatus => {
  const records = raw.split('\0')
  let branch = 'HEAD'
  let upstream: string | undefined
  let ahead = 0; let behind = 0
  const entries: GitStatus['entries'] = []
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index] ?? ''
    if (record.startsWith('# branch.head ')) branch = record.slice(14)
    else if (record.startsWith('# branch.upstream ')) upstream = record.slice(18)
    else if (record.startsWith('# branch.ab ')) {
      const match = /^# branch\.ab \+(\d+) -(\d+)$/.exec(record)
      ahead = Number(match?.[1] ?? 0); behind = Number(match?.[2] ?? 0)
    } else if (/^[12u] /.test(record)) {
      const fields = record.split(' ')
      const xy = fields[1] ?? '..'
      const offset = record[0] === '1' ? 8 : record[0] === '2' ? 9 : 10
      const file = fields.slice(offset).join(' ')
      if (file !== '') entries.push({ path: file, index: xy[0] ?? '.', worktree: xy[1] ?? '.' })
      if (record[0] === '2') index += 1
    } else if (record.startsWith('? ')) entries.push({ path: record.slice(2), index: '?', worktree: '?' })
  }
  return upstream === undefined ? { branch, ahead, behind, entries } : { branch, upstream, ahead, behind, entries }
}
