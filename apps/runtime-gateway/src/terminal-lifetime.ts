/** User input renews idle time; output cannot extend the absolute lifetime. */
export const terminalLifetime = (expire: () => void, idleMs = 15 * 60_000, maximumMs = 60 * 60_000): { touch: () => void; dispose: () => void } => {
  let disposed = false
  let idle: ReturnType<typeof setTimeout>
  const finish = (): void => {
    if (disposed) return
    dispose()
    expire()
  }
  const maximum = setTimeout(finish, maximumMs)
  const dispose = (): void => { disposed = true; clearTimeout(idle); clearTimeout(maximum) }
  const touch = (): void => { if (!disposed) { clearTimeout(idle); idle = setTimeout(finish, idleMs) } }
  touch()
  return { touch, dispose }
}
