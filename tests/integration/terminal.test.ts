import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { TerminalAdapter, type TerminalEvent } from '@tupiniquim/adapters'

let fixture = ''
afterEach(async () => { if (fixture !== '') await rm(fixture, { recursive: true, force: true }) })

describe('TerminalAdapter', () => {
  it('executa uma sessão ConPTY real', async () => {
    const temp = process.env.TEMP
    if (temp === undefined || path.parse(temp).root.toUpperCase() !== 'E:\\') throw new Error('TEMP de testes precisa estar em E:.')
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
    adapter.kill(id)
    expect(events.map((item) => item.data).join('')).toContain('PTY_OK')
  }, 20_000)
})
