import { contextBridge, ipcRenderer } from 'electron'
import { ipcChannels, type AIEvent, type StudioApi, type TerminalDataEvent } from '@tupiniquim/contracts'

const api: StudioApi = {
  system: { info: () => ipcRenderer.invoke(ipcChannels.systemInfo) },
  workspace: {
    pick: () => ipcRenderer.invoke(ipcChannels.workspacePick),
    configure: (input) => ipcRenderer.invoke(ipcChannels.workspaceConfigure, input),
    list: (input) => ipcRenderer.invoke(ipcChannels.workspaceList, input),
    read: (input) => ipcRenderer.invoke(ipcChannels.workspaceRead, input),
    write: (input) => ipcRenderer.invoke(ipcChannels.workspaceWrite, input),
    search: (input) => ipcRenderer.invoke(ipcChannels.workspaceSearch, input),
    context: () => ipcRenderer.invoke(ipcChannels.workspaceContext)
  },
  git: {
    status: () => ipcRenderer.invoke(ipcChannels.gitStatus),
    diff: (relativePath) => ipcRenderer.invoke(ipcChannels.gitDiff, relativePath)
  },
  terminal: {
    create: (input) => ipcRenderer.invoke(ipcChannels.terminalCreate, input),
    write: (input) => ipcRenderer.invoke(ipcChannels.terminalWrite, input),
    resize: (input) => ipcRenderer.invoke(ipcChannels.terminalResize, input),
    kill: (input) => ipcRenderer.invoke(ipcChannels.terminalKill, input),
    onData: (listener) => {
      const wrapped = (_event: Electron.IpcRendererEvent, data: TerminalDataEvent): void => listener(data)
      ipcRenderer.on(ipcChannels.terminalData, wrapped)
      return () => ipcRenderer.removeListener(ipcChannels.terminalData, wrapped)
    }
  },
  agent: {
    status: () => ipcRenderer.invoke(ipcChannels.agentStatus),
    selectProvider: (input) => ipcRenderer.invoke(ipcChannels.agentProviderSelect, input),
    listLocalModels: () => ipcRenderer.invoke(ipcChannels.agentLocalModels),
    selectLocalModel: (input) => ipcRenderer.invoke(ipcChannels.agentLocalModelSelect, input),
    history: (input) => ipcRenderer.invoke(ipcChannels.agentHistory, input),
    send: (input) => ipcRenderer.invoke(ipcChannels.agentSend, input),
    interrupt: (input) => ipcRenderer.invoke(ipcChannels.agentInterrupt, input),
    onEvent: (listener) => {
      const wrapped = (_event: Electron.IpcRendererEvent, data: AIEvent): void => listener(data)
      ipcRenderer.on(ipcChannels.agentEvent, wrapped)
      return () => ipcRenderer.removeListener(ipcChannels.agentEvent, wrapped)
    }
  },
  planning: {
    create: (input) => ipcRenderer.invoke(ipcChannels.planCreate, input),
    update: (input) => ipcRenderer.invoke(ipcChannels.planUpdate, input),
    read: (input) => ipcRenderer.invoke(ipcChannels.executionRead, input),
    decide: (input) => ipcRenderer.invoke(ipcChannels.approvalDecide, input),
    start: (input) => ipcRenderer.invoke(ipcChannels.executionStart, input),
    events: (input) => ipcRenderer.invoke(ipcChannels.executionEvents, input)
  },
  research: {
    search: (input) => ipcRenderer.invoke(ipcChannels.researchSearch, input),
    collect: (input) => ipcRenderer.invoke(ipcChannels.researchCollect, input),
    resolve: (input) => ipcRenderer.invoke(ipcChannels.technologyResolve, input)
  },
  prompt: {
    save: (input) => ipcRenderer.invoke(ipcChannels.promptSave, input),
    list: () => ipcRenderer.invoke(ipcChannels.promptList),
    compile: (input) => ipcRenderer.invoke(ipcChannels.promptCompile, input),
    compare: (input) => ipcRenderer.invoke(ipcChannels.promptCompare, input),
    lint: (input) => ipcRenderer.invoke(ipcChannels.promptLint, input),
    export: (input) => ipcRenderer.invoke(ipcChannels.promptExport, input)
  },
  visual: {
    statuses: () => ipcRenderer.invoke(ipcChannels.visualStatus),
    add: (input) => ipcRenderer.invoke(ipcChannels.visualAssetAdd, input),
    list: () => ipcRenderer.invoke(ipcChannels.visualAssetList),
    use: (input) => ipcRenderer.invoke(ipcChannels.visualAssetUse, input),
    open: (input) => ipcRenderer.invoke(ipcChannels.visualProviderOpen, input)
  },
  settings: {
    get: () => ipcRenderer.invoke(ipcChannels.settingsGet),
    save: (input) => ipcRenderer.invoke(ipcChannels.settingsSave, input),
    export: () => ipcRenderer.invoke(ipcChannels.settingsExport),
    import: (input) => ipcRenderer.invoke(ipcChannels.settingsImport, input)
  }
}

contextBridge.exposeInMainWorld('studio', api)
