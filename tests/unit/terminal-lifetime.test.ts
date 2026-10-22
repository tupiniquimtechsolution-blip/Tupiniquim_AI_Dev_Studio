import { afterEach, describe, expect, it, vi } from 'vitest'
import { terminalLifetime } from '../../apps/runtime-gateway/src/terminal-lifetime'

afterEach(() => vi.useRealTimers())
describe('Gateway terminal resource lifetime', () => {
  it('expires idle sessions once and can dispose without expiration', () => {
    vi.useFakeTimers(); const expire = vi.fn()
    const lifetime = terminalLifetime(expire, 1000, 5000)
    vi.advanceTimersByTime(900); lifetime.touch(); vi.advanceTimersByTime(900)
    expect(expire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(expire).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10_000); expect(expire).toHaveBeenCalledTimes(1)
    const other = terminalLifetime(expire, 1000, 5000); other.dispose()
    vi.advanceTimersByTime(10_000); expect(expire).toHaveBeenCalledTimes(1)
  })
  it('enforces an absolute limit despite continuous input', () => {
    vi.useFakeTimers(); const expire = vi.fn(); const lifetime = terminalLifetime(expire, 1000, 3000)
    for (let index = 0; index < 4; index += 1) { vi.advanceTimersByTime(700); lifetime.touch() }
    expect(expire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200); expect(expire).toHaveBeenCalledTimes(1)
  })
})
