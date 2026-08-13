import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import { z } from 'zod'
import {
  agentInterruptInputSchema,
  agentSendInputSchema,
  approvalDecideInputSchema,
  configureWorkspaceInputSchema,
  err,
  ipcChannels,
  executionIdInputSchema,
  listFilesInputSchema,
  ok,
  readFileInputSchema,
  planCreateInputSchema,
  planUpdateInputSchema,
  promptCompareInputSchema,
  promptCompileInputSchema,
  promptIdInputSchema,
  promptLintInputSchema,
  promptSaveInputSchema,
  researchCollectInputSchema,
  researchSearchInputSchema,
  searchInputSchema,
  terminalCreateInputSchema,
  terminalKillInputSchema,
  terminalResizeInputSchema,
  terminalWriteInputSchema,
  technologyResolveInputSchema,
  uiProfileImportInputSchema,
  uiProfileSaveInputSchema,
  visualAssetAddInputSchema,
  visualAssetUseInputSchema,
  visualProviderOpenInputSchema,
  toAppError,
  writeFileInputSchema,
  type Result
} from '@tupiniquim/contracts'
import { AuditLog, CodexAppServerAdapter, detectPrivateEnvironmentPresence, GitAdapter, HttpResearchProvider, LocalDatabase, TerminalAdapter, WorkspaceAdapter } from '@tupiniquim/adapters'
import { PlanApprovalService, PreferenceService, PromptArchitect, TechnologyResolutionEngine, VisualIntelligenceService } from '@tupiniquim/core'

const dataRoot = 'F:\\CODEX\\Tupiniquim-AI-Dev-Studio.data'
const requiredDataDirectories = ['logs', 'tmp', 'session', 'user-data', 'crash-dumps', 'backups', 'assets', 'research', 'database', 'codex-home']
for (const directory of requiredDataDirectories) mkdirSync(path.join(dataRoot, directory), { recursive: true })

app.setPath('userData', path.join(dataRoot, 'user-data'))
app.setPath('sessionData', path.join(dataRoot, 'session'))
app.setPath('temp', path.join(dataRoot, 'tmp'))
app.setPath('logs', path.join(dataRoot, 'logs'))
app.setPath('crashDumps', path.join(dataRoot, 'crash-dumps'))

const workspace = new WorkspaceAdapter()
const git = new GitAdapter(() => workspace.getRoot())
const audit = new AuditLog(dataRoot)
const database = new LocalDatabase(dataRoot)
const planning = new PlanApprovalService(database)
const research = new HttpResearchProvider(dataRoot)
const technology = new TechnologyResolutionEngine()
const promptArchitect = new PromptArchitect(database)
const visual = new VisualIntelligenceService(database, dataRoot)
const preferences = new PreferenceService(database)
let mainWindow: BrowserWindow | null = null

const terminal = new TerminalAdapter(
  () => workspace.getRoot(),
  (event) => mainWindow?.webContents.send(ipcChannels.terminalData, event)
)
const agent = new CodexAppServerAdapter({
  dataRoot,
  projectRoot: process.cwd(),
  getWorkspaceRoot: () => workspace.getRoot(),
  onEvent: (event) => mainWindow?.webContents.send(ipcChannels.agentEvent, event)
})

const trustedSender = (senderId: number): boolean => mainWindow !== null && mainWindow.webContents.id === senderId

const register = <I, O>(
  channel: string,
  schema: z.ZodType<I>,
  capability: string,
  handler: (input: I) => Promise<O> | O
): void => {
  ipcMain.handle(channel, async (event, raw: unknown): Promise<Result<O>> => {
    const requestId = randomUUID()
    const started = Date.now()
    if (!trustedSender(event.sender.id)) {
      await audit.write({ requestId, at: new Date().toISOString(), capability, outcome: 'DENIED', durationMs: Date.now() - started, errorCode: 'UNTRUSTED_SENDER' })
      return err('UNTRUSTED_SENDER', 'Origem IPC não autorizada.')
    }
    try {
      const input = schema.parse(raw)
      const value = await handler(input)
      await audit.write({ requestId, at: new Date().toISOString(), capability, outcome: 'SUCCESS', durationMs: Date.now() - started })
      return ok(value)
    } catch (cause) {
      const error = toAppError(cause)
      await audit.write({ requestId, at: new Date().toISOString(), capability, outcome: 'ERROR', durationMs: Date.now() - started, errorCode: error.code })
      return { ok: false, error }
    }
  })
}

const registerIpc = (): void => {
  register(ipcChannels.systemInfo, z.undefined(), 'system.info', () => ({
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    dataRoot,
    permissionProfile: 'ASSISTED' as const
  }))
  register(ipcChannels.workspacePick, z.undefined(), 'workspace.pick', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory', 'createDirectory'], title: 'Selecione um workspace' })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
  register(ipcChannels.workspaceConfigure, configureWorkspaceInputSchema, 'workspace.configure', ({ root }) => workspace.configure(root))
  register(ipcChannels.workspaceList, listFilesInputSchema, 'workspace.list', ({ relativePath, depth }) => workspace.list(relativePath, depth))
  register(ipcChannels.workspaceRead, readFileInputSchema, 'workspace.read', ({ relativePath }) => workspace.read(relativePath))
  register(ipcChannels.workspaceWrite, writeFileInputSchema, 'workspace.write', ({ relativePath, content, expectedHash }) => workspace.write(relativePath, content, expectedHash))
  register(ipcChannels.workspaceSearch, searchInputSchema, 'workspace.search', ({ query, limit }) => workspace.search(query, limit))
  register(ipcChannels.gitStatus, z.undefined(), 'git.status', () => git.status())
  register(ipcChannels.gitDiff, z.string().optional(), 'git.diff', (relativePath) => git.diff(relativePath))
  register(ipcChannels.terminalCreate, terminalCreateInputSchema, 'terminal.create', ({ cwd, cols, rows }) => ({ terminalId: terminal.create(cwd, cols, rows) }))
  register(ipcChannels.terminalWrite, terminalWriteInputSchema, 'terminal.write', ({ terminalId, data }) => terminal.write(terminalId, data))
  register(ipcChannels.terminalResize, terminalResizeInputSchema, 'terminal.resize', ({ terminalId, cols, rows }) => terminal.resize(terminalId, cols, rows))
  register(ipcChannels.terminalKill, terminalKillInputSchema, 'terminal.kill', ({ terminalId }) => terminal.kill(terminalId))
  register(ipcChannels.agentStatus, z.undefined(), 'agent.status', () => agent.status())
  register(ipcChannels.agentSend, agentSendInputSchema, 'agent.send', (input) => agent.send(input))
  register(ipcChannels.agentInterrupt, agentInterruptInputSchema, 'agent.interrupt', (input) => agent.interrupt(input))
  register(ipcChannels.planCreate, planCreateInputSchema, 'plan.create', ({ objective, mode }) => planning.create(objective, workspace.getRoot(), mode))
  register(ipcChannels.planUpdate, planUpdateInputSchema, 'plan.update', ({ plan }) => planning.update(plan))
  register(ipcChannels.executionRead, executionIdInputSchema, 'execution.read', ({ executionId }) => planning.read(executionId))
  register(ipcChannels.approvalDecide, approvalDecideInputSchema, 'approval.decide', ({ executionId, stepId, decision, scope }) => planning.decide(executionId, stepId, decision, scope))
  register(ipcChannels.executionStart, executionIdInputSchema, 'execution.start', ({ executionId }) => planning.start(executionId))
  register(ipcChannels.executionEvents, executionIdInputSchema, 'execution.events', ({ executionId }) => planning.events(executionId))
  register(ipcChannels.researchSearch, researchSearchInputSchema, 'research.search', ({ query, maxResults }) => research.search(query, maxResults))
  register(ipcChannels.researchCollect, researchCollectInputSchema, 'research.collect', ({ url }) => research.collect(url))
  register(ipcChannels.technologyResolve, technologyResolveInputSchema, 'technology.resolve', ({ requirements, platforms, availableTools }) => technology.resolve(requirements, platforms, availableTools))
  register(ipcChannels.promptSave, promptSaveInputSchema, 'prompt.save', ({ name, content, variables }) => promptArchitect.save(name, content, variables))
  register(ipcChannels.promptList, z.undefined(), 'prompt.list', () => promptArchitect.list())
  register(ipcChannels.promptCompile, promptCompileInputSchema, 'prompt.compile', ({ templateId, values }) => promptArchitect.compile(templateId, values))
  register(ipcChannels.promptCompare, promptCompareInputSchema, 'prompt.compare', ({ leftId, rightId }) => promptArchitect.compare(leftId, rightId))
  register(ipcChannels.promptLint, promptLintInputSchema, 'prompt.lint', ({ content }) => promptArchitect.lint(content))
  register(ipcChannels.promptExport, promptIdInputSchema, 'prompt.export', ({ templateId }) => promptArchitect.export(templateId))
  register(ipcChannels.visualStatus, z.undefined(), 'visual.status', async () => visual.statuses(await detectPrivateEnvironmentPresence(process.cwd(), ['YANDEX_SEARCH_API_KEY', 'MAGNIFIC_API_KEY', 'EVERYPIXEL_CLIENT_ID', 'KREA_API_KEY'])))
  register(ipcChannels.visualAssetAdd, visualAssetAddInputSchema, 'visual.asset.add', (input) => visual.add(input))
  register(ipcChannels.visualAssetList, z.undefined(), 'visual.asset.list', () => visual.list())
  register(ipcChannels.visualAssetUse, visualAssetUseInputSchema, 'visual.asset.use', ({ assetId }) => visual.assertUsable(assetId))
  register(ipcChannels.visualProviderOpen, visualProviderOpenInputSchema, 'visual.provider.open', async ({ provider }) => {
    const statuses = visual.statuses({})
    const target = statuses.find((candidate) => candidate.id === provider)
    if (target === undefined) throw new Error('Provedor visual desconhecido.')
    await shell.openExternal(target.url)
  })
  register(ipcChannels.settingsGet, z.undefined(), 'settings.get', () => preferences.get())
  register(ipcChannels.settingsSave, uiProfileSaveInputSchema, 'settings.save', ({ profile }) => preferences.save(profile))
  register(ipcChannels.settingsExport, z.undefined(), 'settings.export', () => preferences.export())
  register(ipcChannels.settingsImport, uiProfileImportInputSchema, 'settings.import', ({ serialized }) => preferences.import(serialized))
}

const createWindow = async (): Promise<void> => {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#0B0F12',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0B0F12', symbolColor: '#93A4AF', height: 42 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const developmentUrl = process.env.ELECTRON_RENDERER_URL
    if (developmentUrl === undefined || !url.startsWith(developmentUrl)) event.preventDefault()
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())

  if (process.env.ELECTRON_RENDERER_URL !== undefined) await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { if (mainWindow !== null) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus() } })
  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws://localhost:* http://localhost:*"] } })
    })
    registerIpc()
    await createWindow()
  }).catch((cause: unknown) => {
    const error = toAppError(cause, 'STARTUP_ERROR')
    console.error(`[${error.code}] ${error.message}`)
    void audit.write({ requestId: randomUUID(), at: new Date().toISOString(), capability: 'app.startup', outcome: 'ERROR', durationMs: 0, errorCode: error.code })
    app.exit(1)
  })
}

app.on('before-quit', () => { void agent.close(); void database.close() })
app.on('window-all-closed', () => { terminal.killAll(); app.quit() })
