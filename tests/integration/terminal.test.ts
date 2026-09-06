import os from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { TerminalAdapter, type TerminalEvent } from '@tupiniquim/adapters'

const isWindows = process.platform === 'win32'

let fixture = ''
afterEach(async () => { if (fixture !== '') await rm(fixture, { recursive: true, force: true }) })

describe('TerminalAdapter', () => {
  it('executa uma sessão ConPTY real', async () => {
    if (!isWindows) return // ConPTY and powershell.exe are Windows-only

    const temp = process.env.TEMP ?? process.env.TMP ?? os.tmpdir()
    if (temp === undefined || path.parse(temp).root.toUpperCase() !== 'F:\\')
      throw new Error('TEMP de testes precisa estar em F:.')
    fixture = await mkdtemp(path.join(temp, 'tupiniquim-pty-'))
    const events: TerminalEvent[] = []
    let resolveOutput: (() => void) | undefined
    const output = new Promise<void>((resolve) => { resolveOutput = resolve })
    const adapter = new TerminalAdapter(() => fixture, (event) => {
      events.push(event)
      if (events.map((item) => item.data).join('').includes('PTY_OK')) resolveOutput?.()
    })
    const id = adapter.create('', 80, 24)
    adapter.write(id, "Write-Output 'PTY_OK'\r")
    await Promise.race([output, new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout PTY')), 15_000))])
    await adapter.kill(id)
    expect(events.map((item) => item.data).join('')).toContain('PTY_OK')
  }, 20_000)
})
