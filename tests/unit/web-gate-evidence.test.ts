import { describe, expect, it } from 'vitest'
import { WebState } from '../../apps/web-runtime/src/web-state'
import { toolboxGateRecordSchema } from '../../packages/contracts/src/control-center'

const storageFixture = () => {
  const data = new Map<string, unknown>()
  return {
    get: <T>(key: string): Promise<T | undefined> => Promise.resolve(structuredClone(data.get(key)) as T | undefined),
    put: <T>(key: string, value: T): Promise<void> => { data.set(key, structuredClone(value)); return Promise.resolve() },
    delete: (key: string): Promise<boolean> => Promise.resolve(data.delete(key))
  }
}
const call = async (state: WebState, body: unknown) => {
  const response = await state.fetch(new Request('https://state.local/gate-evidence', { method: 'POST', body: JSON.stringify(body) }))
  return response.json() as Promise<{ ok: boolean; value: unknown }>
}
describe('Workspace runtime evidence receipts', () => {
  it('serializes concurrent records, survives restart and caps retained history', async () => {
    const storage = storageFixture(); const state = new WebState({ storage })
    const makeRecord = (index: number) => ({ id: crypto.randomUUID(), gateId: 'privacy-lgpd', state: 'NOT_AVAILABLE', evidence: `Synthetic receipt fixture ${index}`, startedAt: new Date(0).toISOString(), finishedAt: new Date(index * 1000).toISOString(), source: 'RUNTIME_GATEWAY', hostPlatform: 'fixture', executionConfirmed: false })
    const results = await Promise.all(Array.from({ length: 102 }, (_value, index) => call(state, { action: 'append', record: makeRecord(index) })))
    expect(results.every((item) => item.ok)).toBe(true)
    const listed = await call(new WebState({ storage }), { action: 'list' })
    const records = toolboxGateRecordSchema.array().parse(listed.value)
    expect(records).toHaveLength(100)
    expect(new Set(records.map((item) => item.id)).size).toBe(100)
    expect(records[0]?.evidence).toBe('Synthetic receipt fixture 101')
    expect(records.every((item) => item.executionConfirmed === false)).toBe(true)
    expect((await call(state, { action: 'append', record: { ...makeRecord(999), state: 'invented-pass' } })).ok).toBe(false)
    expect(toolboxGateRecordSchema.array().parse((await call(state, { action: 'list' })).value)).toHaveLength(100)
  })
})
