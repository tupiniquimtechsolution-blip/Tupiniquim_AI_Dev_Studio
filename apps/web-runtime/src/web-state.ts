type DurableStorage = {
  get<T>(key: string): Promise<T | undefined>
  put<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<boolean>
}

type DurableState = {
  storage: DurableStorage
}

const json = (body: unknown, init: ResponseInit = {}): Response => Response.json(body, init)

export class WebState {
  constructor(private readonly state: DurableState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const key = url.searchParams.get('key')?.trim() ?? ''
    if (key === '' || key.length > 512) return json({ ok: false, error: 'INVALID_KEY' }, { status: 400 })

    if (request.method === 'GET') {
      const value = await this.state.storage.get<unknown>(key)
      return json({ ok: true, found: value !== undefined, value: value ?? null })
    }

    if (request.method === 'PUT') {
      const body = await request.json() as { value?: unknown }
      if (!Object.prototype.hasOwnProperty.call(body, 'value')) return json({ ok: false, error: 'VALUE_REQUIRED' }, { status: 400 })
      await this.state.storage.put(key, body.value)
      return json({ ok: true })
    }

    if (request.method === 'DELETE') {
      await this.state.storage.delete(key)
      return json({ ok: true })
    }

    return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
  }
}
