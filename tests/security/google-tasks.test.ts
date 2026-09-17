import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source = async (relativePath: string): Promise<string> =>
  await readFile(path.join(process.cwd(), relativePath), 'utf8')

describe('Google Tasks security boundary', () => {
  it('não expõe access/refresh token pelo preload', async () => {
    const preload = await source('apps/desktop/src/preload/bootstrap.ts')

    expect(preload).not.toContain('accessToken')
    expect(preload).not.toContain('refreshToken')
    expect(preload).not.toContain('GOOGLE_TASKS_CLIENT_SECRET')
    expect(preload).toContain("contextBridge.exposeInMainWorld('googleTasks', googleTasks)")
  })

  it('mantém OAuth no main process com loopback, PKCE state e armazenamento cifrado', async () => {
    const bridge = await source('apps/desktop/src/main/google-tasks-ipc.ts')
    const adapter = await source('packages/adapters/src/google-tasks.ts')

    expect(bridge).toContain("server.listen(0, '127.0.0.1'")
    expect(bridge).not.toContain("server.listen(0, '0.0.0.0'")
    expect(bridge).toContain('safeStorage.encryptString')
    expect(bridge).toContain('safeStorage.decryptString')
    expect(bridge).toContain('receivedState === expectedState')
    expect(bridge).toContain("new PolicyEngine('ASSISTED')")
    expect(adapter).toContain("url.searchParams.set('code_challenge_method', 'S256')")
    expect(adapter).toContain("const TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1'")
  })

  it('não registra token OAuth na auditoria do bridge', async () => {
    const bridge = await source('apps/desktop/src/main/google-tasks-ipc.ts')
    const auditWrites = [...bridge.matchAll(/audit\(\)\.write\(\{([\s\S]*?)\}\)/gu)].map((match) => match[1] ?? '')

    expect(auditWrites.length).toBeGreaterThan(0)
    for (const auditWrite of auditWrites) {
      expect(auditWrite).not.toContain('accessToken')
      expect(auditWrite).not.toContain('refreshToken')
      expect(auditWrite).not.toContain('clientSecret')
    }
  })
})
