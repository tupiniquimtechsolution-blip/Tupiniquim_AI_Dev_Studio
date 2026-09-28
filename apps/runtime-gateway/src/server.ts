import { createHash, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Socket } from 'node:net'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import * as pty from 'node-pty'

type JsonRecord = Record<string, unknown>

const PORT = Number(process.env.TUPINIQUIM_GATEWAY_PORT ?? '43721')
const HOST = process.env.TUPINIQUIM_GATEWAY_HOST?.trim() || '127.0.0.1'
const TOKEN = process.env.TUPINIQUIM_GATEWAY_TOKEN?.trim() ?? ''
const ROOT = path.resolve(process.env.TUPINIQUIM_GATEWAY_ROOT?.trim() || '.tupiniquim/runtime-gateway')
const MAX_BODY = 12 * 1024 * 1024
const SAFE_ID = /^[a-zA-Z0-9_-]{8,96}$/

const json = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(body))
}

const secureEqual = (left: string, right: string): boolean => {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

const authorized = (request: IncomingMessage): boolean => {
  if (TOKEN.length < 24) return false
  const header = request.headers.authorization ?? ''
  return header.startsWith('Bearer ') && secureEqual(header.slice(7), TOKEN)
}

const workspaceRoot = async (workspaceId: string): Promise<string> => {
  if (!SAFE_ID.test(workspaceId)) throw new Error('Workspace ID inválido.')
  const root = path.join(ROOT, 'workspaces', workspaceId, 'workspace')
  await fs.mkdir(root, { recursive: true })
  return root
}

const resolveWorkspacePath = async (workspaceId: string, requested: string): Promise<string> => {
  const root = await workspaceRoot(workspaceId)
  const relative = requested.replace(/\\/g, '/').replace(/^\/workspace\/?/, '').replace(/^\/+/, '')
  if (relative.includes('\0') || relative.split('/').some((part) => part === '..')) throw new Error('Caminho inválido.')
  const target = path.resolve(root, relative)
  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`
  if (target !== root && !target.startsWith(rootPrefix)) throw new Error('Caminho fora do workspace.')
  return target
}

const readBody = async (request: IncomingMessage): Promise<JsonRecord> => {
  const decoder = new TextDecoder()
  let raw = ''
  let total = 0
  for await (const chunk of request as AsyncIterable<unknown>) {
    if (!(chunk instanceof Uint8Array)) throw new Error('Chunk HTTP inválido.')
    total += chunk.byteLength
    if (total > MAX_BODY) throw new Error('Payload excede o limite do gateway.')
    raw += decoder.decode(chunk, { stream: true })
  }
  raw += decoder.decode()
  return raw === '' ? {} : JSON.parse(raw) as JsonRecord
}

const runProcess = async (
  executable: string,
  args: string[],
  cwd: string,
  timeoutMs = 180_000
): Promise<{ code: number; stdout: string; stderr: string }> => new Promise((resolve, reject) => {
  const child = spawn(executable, args, { cwd, windowsHide: true, env: process.env })
  let stdout = ''
  let stderr = ''
  const timer = setTimeout(() => {
    child.kill()
    reject(new Error(`Comando excedeu ${timeoutMs}ms.`))
  }, timeoutMs)
  child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
  child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })
  child.on('error', (error) => { clearTimeout(timer); reject(error) })
  child.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? 1, stdout, stderr }) })
})

const executable = (name: string): string => process.platform === 'win32' ? `${name}.cmd` : name

const listTree = async (workspaceId: string, depth: number): Promise<JsonRecord[]> => {
  const root = await workspaceRoot(workspaceId)
  const maxDepth = Math.max(1, Math.min(8, Math.floor(depth)))
  const output: JsonRecord[] = []
  const walk = async (directory: string, currentDepth: number): Promise<void> => {
    if (currentDepth > maxDepth) return
    const entries = await fs.readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue
      const absolute = path.join(directory, entry.name)
      const relativePath = path.relative(root, absolute).split(path.sep).join('/')
      const stat = await fs.stat(absolute)
      output.push({
        name: entry.name,
        relativePath,
        kind: entry.isDirectory() ? 'directory' : 'file',
        size: entry.isDirectory() ? 0 : stat.size,
        modifiedAt: stat.mtime.toISOString()
      })
      if (entry.isDirectory()) await walk(absolute, currentDepth + 1)
    }
  }
  await walk(root, 1)
  return output
}

const searchWorkspace = async (workspaceId: string, query: string, limit: number): Promise<JsonRecord[]> => {
  const root = await workspaceRoot(workspaceId)
  const max = Math.max(1, Math.min(500, Math.floor(limit)))
  const results: JsonRecord[] = []
  const walk = async (directory: string): Promise<void> => {
    if (results.length >= max) return
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (results.length >= max) return
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'release' || entry.name === 'out') continue
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) { await walk(absolute); continue }
      const stat = await fs.stat(absolute)
      if (stat.size > 2 * 1024 * 1024) continue
      let content: string
      try { content = await fs.readFile(absolute, 'utf8') } catch { continue }
      const lines = content.split(/\r?\n/)
      for (let index = 0; index < lines.length && results.length < max; index += 1) {
        if (lines[index]?.includes(query)) {
          results.push({ relativePath: path.relative(root, absolute).split(path.sep).join('/'), line: index + 1, preview: lines[index] ?? '' })
        }
      }
    }
  }
  await walk(root)
  return results
}

const gate = async (workspaceId: string, gateId: string): Promise<{ state: 'PASS' | 'FAIL'; evidence: string }> => {
  const cwd = await workspaceRoot(workspaceId)
  const steps: Record<string, Array<[string, string[]]>> = {
    'quality-gates': [[executable('pnpm'), ['lint']], [executable('pnpm'), ['typecheck']], [executable('pnpm'), ['test:unit']]],
    'dependency-audit': [[executable('pnpm'), ['audit', '--audit-level', 'high']]],
    'security-review': [[executable('pnpm'), ['test:security']]],
    'architecture-review': [[executable('pnpm'), ['typecheck']]],
    'supply-chain': [[executable('pnpm'), ['install', '--frozen-lockfile']]],
    'release-checklist': [[executable('pnpm'), ['build']]],
    'privacy-lgpd': [['git', ['grep', '-niE', '(lgpd|privacy|privacidade)', '--', 'AGENTS.md', 'docs', '.agent']]],
    'accessibility-wcag': [['git', ['grep', '-niE', '(aria-|accessib|wcag)', '--', 'apps', 'packages']]]
  }
  if (gateId === 'secret-scan') {
    const result = await runProcess('git', ['grep', '-nE', '(sk-(proj-)?[A-Za-z0-9_-]{20,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY)', '--', '.', ':!pnpm-lock.yaml'], cwd)
    if (result.code === 1) return { state: 'PASS', evidence: 'Nenhum padrão de secret encontrado.' }
    return { state: 'FAIL', evidence: (result.stdout + '\n' + result.stderr).trim().slice(-12_000) || `git grep terminou com código ${result.code}` }
  }
  const commands = steps[gateId]
  if (!commands) throw new Error('Gate desconhecido.')
  let evidence = ''
  for (const [bin, args] of commands) {
    const result = await runProcess(bin, args, cwd)
    evidence += `$ ${bin} ${args.join(' ')}\n${result.stdout}\n${result.stderr}\n`
    if (result.code !== 0) return { state: 'FAIL', evidence: evidence.trim().slice(-12_000) }
  }
  return { state: 'PASS', evidence: evidence.trim().slice(-12_000) || 'Gate concluído.' }
}

const stringArg = (record: JsonRecord, key: string, fallback = ''): string =>
  typeof record[key] === 'string' ? record[key] as string : fallback

const numberArg = (record: JsonRecord, key: string, fallback: number): number =>
  typeof record[key] === 'number' && Number.isFinite(record[key]) ? record[key] as number : fallback

const handleRpc = async (body: JsonRecord): Promise<unknown> => {
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
  const method = typeof body.method === 'string' ? body.method : ''
  const args = body.args !== null && typeof body.args === 'object' ? body.args as JsonRecord : {}
  if (!SAFE_ID.test(workspaceId)) throw new Error('Workspace ID inválido.')

  if (method === 'fs.exists') {
    const target = await resolveWorkspacePath(workspaceId, stringArg(args, 'path'))
    try { await fs.access(target); return { exists: true } } catch { return { exists: false } }
  }
  if (method === 'fs.mkdir') {
    await fs.mkdir(await resolveWorkspacePath(workspaceId, stringArg(args, 'path')), { recursive: args.recursive === true })
    return null
  }
  if (method === 'fs.read-file') return { content: await fs.readFile(await resolveWorkspacePath(workspaceId, stringArg(args, 'path')), 'utf8') }
  if (method === 'fs.write-file') {
    const target = await resolveWorkspacePath(workspaceId, stringArg(args, 'path'))
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, stringArg(args, 'content'), 'utf8')
    return null
  }
  if (method === 'workspace.tree') return listTree(workspaceId, numberArg(args, 'depth', 4))
  if (method === 'workspace.search') return searchWorkspace(workspaceId, stringArg(args, 'query'), numberArg(args, 'limit', 100))
  if (method === 'git.status') {
    const cwd = await workspaceRoot(workspaceId)
    const result = await runProcess('git', ['status', '--porcelain=v1', '-b'], cwd, 15_000)
    if (result.code !== 0) return { branch: 'remote-workspace', ahead: 0, behind: 0, entries: [] }
    const lines = result.stdout.split(/\r?\n/).filter(Boolean)
    const branchLine = lines.shift() ?? '## remote-workspace'
    const branch = branchLine.replace(/^##\s*/, '').split('...')[0]?.trim() || 'remote-workspace'
    return { branch, ahead: 0, behind: 0, entries: lines.map((line) => ({ path: line.slice(3).trim(), index: line[0] ?? ' ', worktree: line[1] ?? ' ' })) }
  }
  if (method === 'git.diff') {
    const cwd = await workspaceRoot(workspaceId)
    const relativePath = typeof args.relativePath === 'string' && args.relativePath !== '' ? args.relativePath : null
    if (relativePath !== null) await resolveWorkspacePath(workspaceId, relativePath)
    const result = await runProcess('git', relativePath === null ? ['diff', '--'] : ['diff', '--', relativePath], cwd, 15_000)
    if (result.code !== 0) throw new Error(result.stderr || 'Falha no git diff.')
    return result.stdout
  }
  if (method === 'workspace.bootstrap-repo') {
    const cwd = await workspaceRoot(workspaceId)
    try {
      await fs.access(path.join(cwd, '.git'))
      return { cloned: false, detail: 'Repositório já inicializado.' }
    } catch { /* clone below */ }
    const repository = stringArg(args, 'repository')
    const ref = stringArg(args, 'ref', 'main')
    if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(repository)) throw new Error('Repositório bootstrap não permitido.')
    if (!/^[A-Za-z0-9._/-]{1,200}$/.test(ref)) throw new Error('Ref bootstrap inválida.')
    const result = await runProcess('git', ['clone', '--depth', '1', '--branch', ref, repository, '.'], cwd, 120_000)
    if (result.code !== 0) throw new Error(result.stderr || 'Falha ao clonar workspace.')
    return { cloned: true, detail: result.stdout || result.stderr || 'Clone concluído.' }
  }
  if (method === 'control.gate') return gate(workspaceId, stringArg(args, 'gateId'))
  if (method === 'workspace.backup-create') {
    const id = createHash('sha256').update(`${workspaceId}:${Date.now()}:${stringArg(args, 'name')}`).digest('hex').slice(0, 32)
    const source = await workspaceRoot(workspaceId)
    const backup = path.join(ROOT, 'backups', workspaceId, id)
    await fs.rm(backup, { recursive: true, force: true })
    await fs.mkdir(path.dirname(backup), { recursive: true })
    await fs.cp(source, backup, { recursive: true, filter: (sourcePath) => !sourcePath.includes(`${path.sep}node_modules${path.sep}`) && !sourcePath.includes(`${path.sep}.git${path.sep}objects${path.sep}`) })
    return { id, kind: 'REMOTE_LOCAL', createdAt: new Date().toISOString() }
  }
  if (method === 'workspace.backup-restore') {
    const handle = args.handle !== null && typeof args.handle === 'object' ? args.handle as JsonRecord : {}
    const id = typeof handle.id === 'string' && /^[a-f0-9]{32}$/.test(handle.id) ? handle.id : null
    if (id === null) throw new Error('Backup handle inválido.')
    const backup = path.join(ROOT, 'backups', workspaceId, id)
    const target = await workspaceRoot(workspaceId)
    await fs.access(backup)
    await fs.rm(target, { recursive: true, force: true })
    await fs.mkdir(target, { recursive: true })
    await fs.cp(backup, target, { recursive: true })
    return null
  }
  throw new Error(`Método de gateway não permitido: ${method || '(vazio)'}`)
}

const websocketAccept = (key: string): string =>
  createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64')

const frame = (opcode: number, payload: Buffer): Buffer => {
  const length = payload.length
  if (length < 126) return Buffer.concat([Buffer.from([0x80 | opcode, length]), payload])
  if (length <= 0xffff) {
    const header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(length, 2)
    return Buffer.concat([header, payload])
  }
  const header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(length), 2)
  return Buffer.concat([header, payload])
}

const attachTerminal = async (request: IncomingMessage, socket: Socket, head: Buffer): Promise<void> => {
  if (!authorized(request)) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return }
  const key = request.headers['sec-websocket-key']
  if (typeof key !== 'string') { socket.destroy(); return }
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  const workspaceId = request.headers['x-tupiniquim-workspace'] ?? url.searchParams.get('workspace') ?? ''
  if (typeof workspaceId !== 'string' || !SAFE_ID.test(workspaceId)) { socket.write('HTTP/1.1 400 Bad Request\r\n\r\n'); socket.destroy(); return }
  const cwd = await workspaceRoot(workspaceId)
  const cols = Math.max(20, Math.min(500, Number(url.searchParams.get('cols') ?? 100)))
  const rows = Math.max(5, Math.min(200, Number(url.searchParams.get('rows') ?? 30)))
  const shell = process.platform === 'win32' ? (process.env.TUPINIQUIM_GATEWAY_SHELL?.trim() || 'powershell.exe') : (process.env.SHELL?.trim() || '/bin/bash')
  const args = process.platform === 'win32' ? ['-NoLogo', '-NoProfile'] : ['--noprofile', '--norc']
  const terminal = pty.spawn(shell, args, { cwd, cols, rows, name: 'xterm-256color', env: process.env })

  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${websocketAccept(key)}`,
    '\r\n'
  ].join('\r\n'))

  terminal.onData((data) => socket.write(frame(0x2, Buffer.from(data, 'utf8'))))
  terminal.onExit(({ exitCode }) => {
    if (!socket.destroyed) {
      socket.write(frame(0x1, Buffer.from(JSON.stringify({ type: 'exit', code: exitCode }), 'utf8')))
      socket.end()
    }
  })

  let buffer = head.length > 0 ? Buffer.from(head) : Buffer.alloc(0)
  const consume = (): void => {
    while (buffer.length >= 2) {
      const opcode = buffer[0]! & 0x0f
      const masked = (buffer[1]! & 0x80) !== 0
      let length = buffer[1]! & 0x7f
      let offset = 2
      if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4 }
      else if (length === 127) {
        if (buffer.length < 10) return
        const large = buffer.readBigUInt64BE(2)
        if (large > BigInt(1024 * 1024)) { socket.destroy(); return }
        length = Number(large); offset = 10
      }
      const maskBytes = masked ? 4 : 0
      if (buffer.length < offset + maskBytes + length) return
      const mask = masked ? buffer.subarray(offset, offset + 4) : null
      const payload = Buffer.from(buffer.subarray(offset + maskBytes, offset + maskBytes + length))
      buffer = buffer.subarray(offset + maskBytes + length)
      if (mask !== null) for (let index = 0; index < payload.length; index += 1) payload[index] = payload[index]! ^ mask[index % 4]!
      if (opcode === 0x8) { terminal.kill(); socket.end(); return }
      if (opcode === 0x9) { socket.write(frame(0xA, payload)); continue }
      if (opcode === 0x2) { terminal.write(payload.toString('utf8')); continue }
      if (opcode === 0x1) {
        const text = payload.toString('utf8')
        try {
          const control = JSON.parse(text) as JsonRecord
          if (control.type === 'resize') terminal.resize(Math.max(20, Number(control.cols ?? cols)), Math.max(5, Number(control.rows ?? rows)))
          else terminal.write(text)
        } catch { terminal.write(text) }
      }
    }
  }
  socket.on('data', (chunk: Buffer) => { buffer = Buffer.concat([buffer, chunk]); consume() })
  socket.on('close', () => terminal.kill())
  socket.on('error', () => terminal.kill())
  consume()
}

await fs.mkdir(ROOT, { recursive: true })

const handleHttp = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  try {
    if (!authorized(request)) { json(response, 401, { ok: false, error: { code: 'AUTH_REQUIRED', message: 'Gateway token inválido.' } }); return }
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
    if (request.method === 'GET' && url.pathname === '/health') {
      json(response, 200, {
        ok: true,
        product: 'Tupiniquim Runtime Gateway',
        runtime: 'remote-local',
        platform: process.platform,
        arch: process.arch,
        capabilities: ['workspace', 'git', 'terminal', 'build', 'tests', 'local-persistence']
      })
      return
    }
    if (request.method === 'POST' && url.pathname === '/rpc') {
      const value = await handleRpc(await readBody(request))
      json(response, 200, { ok: true, value })
      return
    }
    json(response, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'Endpoint não encontrado.' } })
  } catch (cause) {
    json(response, 500, { ok: false, error: { code: 'RUNTIME_GATEWAY_ERROR', message: cause instanceof Error ? cause.message : 'Falha no gateway.', retryable: true } })
  }
}

const server = createServer((request, response) => {
  void handleHttp(request, response)
})

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  if (url.pathname !== '/terminal') { socket.destroy(); return }
  void attachTerminal(request, socket, head).catch(() => socket.destroy())
})

server.listen(PORT, HOST, () => {
  process.stdout.write(`Tupiniquim Runtime Gateway READY http://${HOST}:${PORT}\n`)
})
